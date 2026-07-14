const rateLImit = require('express-rate-limit');

const generalLimiter = rateLImit({
    windowMs:15 * 60 * 1000,
    max:100,

    handler:(req , res) => {
        res.status(429).json({
            success: false,
            error:{
                message:"Too many requests from this IP, please try again after 15 minutes",
                code:'RATE_LIMIT_EXCEEDED',
                status:429
            }
        })
    },

    standardHeaders:true,
    legacyHeaders:false
})


const authLimiter = rateLImit({
    windowMs:15 * 60 * 1000,
    max:10,

    handler:(req , res) => {
        res.status(429).json({
            success: false,
            error:{
                message:"Too many login attempts, please try again after 15 minutes",
                code:'RATE_LIMIT_EXCEEDED',
                status:429
            }
        })
    },

    standardHeaders:true,
    legacyHeaders:false
})


module.exports = {generalLimiter , authLimiter}

