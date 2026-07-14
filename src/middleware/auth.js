const jwt = require("jsonwebtoken")

const protect = (req ,res , next) => {
    const authHeader = req.headers['authorization']

    if(!authHeader){
        return res.status(401).json({
            success:false,
            error:{
                message:"No token provided",
                code:'NO_TOKEN',
                status:401
            }
        })
    }

    const token = authHeader.split(' ')[1]

    if(!token){
        return res.status(401).json({
            success:false,
            error:{
                message:"No token provided",
                code:"NO_TOKEN",
                status:401
            }
        })
    }

    try{
        const decoded = jwt.verify(token , process.env.JWT_SECRET)

        req.user = decoded

        next()

    }
    catch(error){
        if(error.name === 'TokenExpiredError'){
            return res.status(401).json({
                success:false,
                error:{
                    message:"Token expired , please login again",
                    code:"TOKEN_EXPIRED",
                    status:401
                }
            })
        }
        return res.status(401).json({
             success: false,
             error: {
                 message: 'Invalid token', 
                 code: 'INVALID_TOKEN', 
                 status: 401 
        }
    })

    }
}


const requireRole = (...roles) => {
    return(req , res , next) => {
        if(!roles.includes(req.user.role)){
            return res.status(403).json({
                success:false,
                error:{
                    message:`This action requires one of these roles: ${roles.join(', ')}`,
                    code: 'FORBIDDEN',
                    status: 403
                }
            })
        }

    next()    

    }
}

module.exports = {protect , requireRole}