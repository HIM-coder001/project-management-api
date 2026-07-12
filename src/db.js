require("dotenv").config();
const {Pool} = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
})

//connection testing
pool.connect((err, client, release) => {
    if(err){
        console.error("Database connection error", err.message)
    }
    else{
        console.log("Connected to postgreSQL")
    }
    release()
})

module.exports = pool;