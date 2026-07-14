require("dotenv").config()

const express = require("express")
const app = express()
const PORT = process.env.PORT || 3000

require("./src/db.js")
// require("./src/redis.js")
require("./scripts/migrate.js")

//Middleware
app.use(express.json())

//Rate Limiter
const{generalLimiter , authLimiter} = require("./src/middleware/rateLimiter.js")
app.use(generalLimiter)

//Routes
const authRoutes = require("./src/routes/authRoutes.js")
const organisationsRoutes = require("./src/routes/organisationRoutes.js")
// const membersRoutes = require("./src/routes/memberRoutes.js")
// const projectsRoutes = require("./src/routes/projectRoutes.js")
// const tasksRoutes = require("./src/routes/taskRoutes.js")

app.use("/api/v1/auth", authLimiter, authRoutes)
app.use("/api/v1/organisations", organisationsRoutes)
// app.use("/api/v1/members", membersRoutes)
// app.use("/api/v1/projects", projectsRoutes)
// app.use("/api/v1/tasks", tasksRoutes)

//Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

//404 Handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: {
            message: "Route not found",
            code: "ROUTE_NOT_FOUND",
            status: 404
        }
    })
})

//Global Error Handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err)
    res.status(err.status||500).json({
        success: false,
        error:{
            message: err.message || "Something went wrong",
            code: err.code || "INTERNAL_SERVER_ERROR",
            status: err.status || 500
        }
    })
})


module.exports = app

if(require.main === module){
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`)
    })
}