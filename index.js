const express = require('express')
const app = express()
const cookieParser = require('cookie-parser');
const session = require('express-session');
//stops sql injection attack by default
const mysql = require('mysql');
const bodyParser = require('body-parser');
//encrypting password
const crypt = require('bcrypt');
//reads files
const fs = require('fs');
//for .env ignore files to hide data for security
require('dotenv').config() 

const saltRounds = 10

//gets the info from the .env file which will be git ignored for security purposes
const connection = mysql.createPool({
    connectionLimit: process.env.DBpool,
    host: process.env.DBhost,
    user: process.env.DBuser,
    password: process.env.DBpass,
    database: process.env.DB
})

const table = `CREATE TABLE IF NOT EXISTS users (
    id int(10) NOT NULL AUTO_INCREMENT, 
    username VARCHAR(255) NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    password VARCHAR(255) NOT NULL,
    PRIMARY KEY (id))`;
connection.query(table, (err, result) => {
    if (err) throw err;
  });
const translateTable = `CREATE TABLE IF NOT EXISTS translate (
    username VARCHAR(255) NOT NULL,
    english VARCHAR(255) NOT NULL,
    spanish VARCHAR(255) NOT NULL,
    PRIMARY KEY (english))`;
connection.query(translateTable, (err, result) => {
    if (err) throw err;
  });
  app.use(cookieParser());
  app.use(session({
      secret: 'secret',
      resave: true,
      saveUninitialized: true,
      db: process.env.DB
  }));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'))


const sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
        res.redirect('/');
    } else {
        next();
    }    
};

//__dirname is for the directory it is currently in
//./ is for the directory it started running in
app.get('/', sessionChecker, (req, res) => {
    //res.sendFile(__dirname + '/views/partials/index.hbs');
    res.sendFile('/index.html')
});

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/public/register.html');
});

app.post('/auth', (req, res) => {
    let hash = crypt.hashSync(req.body.pass, saltRounds);
    const users = {
        "username": req.body.user,
        "email": req.body.email,
        "password": hash
    }

    connection.query('INSERT INTO CS174.users SET ?', users, (error, results, fields) => {
        if (!error) {
            res.redirect('/')
        } else {
            console.log(error)
            res.status(404).send("Sorry can't find that!")
        }
      });
});

app.post('/login', (req, res) => {
    let hash = crypt.hashSync(req.body.pass, saltRounds);
    const users = {
        "username": req.body.user,
        "password": hash
    }
    
    if (users) {
		connection.query('SELECT * FROM users WHERE username = ?', users.username, (error, results, fields) => {
            //checks if username is correct and compareSync checks if password is correct, compareSync(plaintextPassword, hashedPassword)
			if (!error && crypt.compareSync(req.body.pass, results[0].password)) {
                req.session.loggedin = true;
                req.session.user = users.username;
				res.redirect('/home');
			} else {
                res.send('Incorrect Username and/or Password!');
			}
			res.end();
		});
	} else {
		res.send('Please enter Username and Password!');
		res.end();
	}
});

app.get('/home', (req, res) => {
    res.sendFile(__dirname + '/public/home.html')
})


app.post('/translate', async (req, res) => {
    let file1 = req.body.translate;
    let file2 = req.body.translate2;
    let input = req.body.search;
    let array1;
    let array2;

    if (file1 && file2) {
        try {
            fs.readFile(file1, function(err, data) {
                if (err) throw err;
                array1 = data.toString().split("\n");
            });
            fs.readFile(file2, function(err, data) {
                if (err) throw err;
                array2 = data.toString().split("\n");
            });
            await sleep(50)
            let user1 = req.session.user;
            for (let i = 0; i < array1.length; i++) {
                connection.query('REPLACE INTO translate SET ?', {username: user1, english: array1[i], spanish:array2[i]}, (error, results, fields) => {
                    if (error) {
                        console.log(error)
                    }
                })
            }
            res.redirect('/home')
        } catch (e) {
            res.send(e)
        }
    }
    if (input) {
        connection.query(`SELECT spanish FROM CS174.translate WHERE english LIKE '%${input}%' AND username = '${req.session.user}'`, (error, results, fields) => {
            if (!error) {
                res.send(results[0].spanish)
            } else {
                console.log(error)
            }
        })
    }
})

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

const server = app.listen(process.env.port, process.env.host, () => {
    console.log('Server is up and running on ' + process.env.host, process.env.port);
})