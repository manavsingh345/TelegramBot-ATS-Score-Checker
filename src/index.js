const express = require('express');

require('dotenv').config();

const PORT = process.env.PORT || 8080;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Template Engine settings
const path = require("path");

app.set("view engine","ejs");
app.set('views','./src/views');
app.use("/static", express.static(path.join(__dirname, "../public")));

// Session
const session = require('express-session');
app.use(session({
    secret : "hello world",
    resave : false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 *24
    }
})); 


// Helpers
const {bot} = require('./helpers/telegramBot');  
const connectDB = require('./helpers/database');

// Routes
const homeRoutes = require('./routes/home');

app.use(homeRoutes);

const startup = async () => {

    app.listen(PORT, () => {
        bot.launch();
        connectDB();
        
        console.log('started at ' + PORT)
    });
}
startup();
