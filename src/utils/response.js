const sendSuccess = (res , data , message='success' , status=200) =>{
    res.status(status).json({
        success:true,
        message,
        data,
    })
}

const sendError = (res, message, code='INTERNAL_SERVER_ERROR', status=500) => {
    res.status(status).json({
        success:false,
        error:{
            message,
            code,
            status
        }
    })
}

module.exports = {sendSuccess , sendError}