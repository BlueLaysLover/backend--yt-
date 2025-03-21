const asynchandler = (fn) => async(req , res , next) => {
    try {
         await fn(req , res, next)
    } catch (error) {
        // Log the error for debugging
        console.error("Error in async handler:", error);
        
        // Get potential status code from error object
        let statusCode = error.statusCode || (typeof error.code === 'number' ? error.code : 500);
        
        // Validate the status code (must be between 100-599)
        if (typeof statusCode !== 'number' || statusCode < 100 || statusCode > 599) {
            console.error(`Invalid status code: ${statusCode}, defaulting to 500`);
            statusCode = 500;
        }
        
        res.status(statusCode).json({
            success: false,
            message: error.message
        })
    }
}





export{asynchandler}