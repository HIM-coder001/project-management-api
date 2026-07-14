const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto')
const pool = require('../db');
const {sendSuccess , sendError}= require('../utils/response');
const {
    validateRequestBody,
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword
} = require('../middleware/validators');


//POST /api/v1/auth/register
router.post('/register', validateRequestBody, validateRegister, async (req , res) => {
    try{
        //get data sent by the user
        const {organisationName ,name , email , password} = req.body;
        if(password.length < 6){
            return sendError(
                res,
                'Password must be at least 6 characters long',
                'VALIDATION_ERROR',
                400
            )
        }

        //check email is not already taken
        const existingUser = await pool.query('SELECT id FROM users WHERE email=$1' ,
             [email]
        )

        if(existingUser.rows[0]){
            return sendError(
                res,
                'Email already registered',
                'DUPLICATE_EMAIL',
                400
            )
        }

        //generate a slug from the organisation name
        const slug = organisationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

        //check slug is not taken 
        const existingOrg = await pool.query(
            'SELECT id FROM organisations WHERE slug=$1',
            [slug]
        )
        if(existingOrg.rows[0]){
            return sendError(
                res,
                "An organisation with a similar name already exists",
                'DUPLICATE_ORG',
                400
            )
        }

        //password hashing
        const hashedPassword = await bcrypt.hash(password , 10)

        const client = await pool.connect()

         try {
            //start a transaction
      await client.query('BEGIN')

      // save the organisation to the db
      const orgResult = await client.query(
        `INSERT INTO organisations (name, slug)
         VALUES ($1, $2)
         RETURNING *`,
        [organisationName, slug]
      )
      const organisation = orgResult.rows[0]

      // save the user and link to organisation
      const userResult = await client.query(
        `INSERT INTO users (organisation_id, name, email, password, role)
         VALUES ($1, $2, $3, $4, 'owner')
         RETURNING id, name, email, role, organisation_id, created_at`,
        [organisation.id, name, email, hashedPassword]
      )
      const user = userResult.rows[0]
      
      //everything worked - save it all permanently
      await client.query('COMMIT')
      
      const token = jwt.sign(
        {
          id:             user.id,
          email:          user.email,
          role:           user.role,
          organisationId: organisation.id
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      )

      return sendSuccess(
        res,
        { token, user, organisation },
        'Organisation created successfully',
        201
      )

    } catch (transactionError) {
        //undo everything since BEGIN
      await client.query('ROLLBACK')
      throw transactionError
    } finally {
      client.release()

    }

    }
    catch(error){
         console.error('Register error:', error.message)
        return sendError(
          res, 
          'Registration failed',  
          'REGISTER_FAILED',
          500
        )
         
    }
})


//POST /api/v1/auth/login
router.post('/login', validateRequestBody, validateLogin, async (req , res) => {
    try{
        //get data sent by the user
        const {email , password} = req.body
        

        //find user by email
        const result = await pool.query(
            `SELECT
                u.*,
                o.name AS organisation_name,
                o.slug AS organisation_slug
                FROM users u
                JOIN organisations o ON u.organisation_id = o.id
                WHERE u.email = $1
                AND u.is_active = true`,
                [email]
        )

        const user = result.rows[0]

        if(!user){
            return sendError(
                res,
                'Invalid credentials',
                'INVALID_CREDENTIALS',
                401,
            )
        }

        //compare passwords
        const passwordMatch = await bcrypt.compare(password , user.password)

        if(!passwordMatch){
            return sendError(
                res,
                'Invalid credentials',
                'INVALID_CREDENTIALS',
                401
            )
        }

        //update last login time 
        await pool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id=$1',
            [user.id]
        )

        //create a token
        const token = jwt.sign(
            {
                id :            user.id,
                email:          user.email,
                role:           user.role,
                organisationId: user.organisation_id
            },
            process.env.JWT_SECRET,
            {expiresIn: process.env.JWT_EXPIRES_IN}
        )

        return sendSuccess(
            res,
            {
                token,
                user:{
                     id:    user.id,
                     name:  user.name,
                     email: user.email,
                     role:  user.role,
                     organisation: {
                     id:   user.organisation_id,
                     name: user.organisation_name,
                     slug: user.organisation_slug
                    }
                }
            },
            'Login successful'
        )

    }
    catch(error){
        console.error('Login error:', error.message)
        return sendError(
            res,
            'Login failed',
            "LOGIN_FAILED",
            500
        )
    }
})


//POST /api/v1/auth/forgot-password
router.post('/forgot-password', validateRequestBody, validateForgotPassword, async(req , res) => {
    try {
        //get data sent by the user
        const { email } = req.body
        

        //find the user 
        const result = await pool.query(
            'SELECT id , name , email FROM users WHERE email = $1 and is_active = true',
            [email]
        )

        const user = result.rows[0]
        
        //for security-we return the exact same message whether the email exists or not
        if(!user){
            return sendSuccess(
                res,
                {},
                'If that email exists you will receive a reset link shortly'
            )
        }

        //generate a random token
        const resetToken = crypto.randomBytes(32).toString('hex')

        //token expires in 1 hour
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

        //save the token and expiry to the db
        await pool.query(
            `UPDATE users
            SET reset_token          = $1,
                reset_token_expires  = $2
            WHERE id = $3 `,
            [resetToken , expiresAt , user.id]
        )

        console.log(`Reset link: ${process.env.APP_URL}/reset-password?token=${resetToken}`);

        return sendSuccess(
            res,
            {},
            'If that email exists you will receie a reset link shortly'
        )


    } catch (error) {
        console.error('Forgot password error:' , error.message)
        return sendError(
            res,
            'Something went wrong',
            "FORGOT_PASSWORD",
            500
        )
    }
})

//POST /api/v1/auth/reset-password
router.post('/reset-password', validateRequestBody, validateResetPassword, async (req , res) => {
    try {
        const { token, password } = req.body


        const result = await pool.query(
            `SELECT id FROM users
            WHERE reset_token  =$1
            AND reset_token_expires > NOW()
            AND is_active      =true
            `,
            [token]
        )

        if(!result.rows[0]){
            return sendError(
                res,
                'This reset link is invalid or has expired',
                'INVALID_RESET_TOKEN',
                400
            )
        }

        const user = result.rows[0]

        const hashedPassword = await bcrypt.hash(password , 10)

        await pool.query(
            `UPDATE users 
            SET password             = $1,
                reset_token          = NULL,
                reset_token_expires  = NULL,
                updated_at           = NOW()
            WHERE id = $2    
            `,
            [hashedPassword , user.id]
        )

        return sendSuccess(
            res,
            {},
            "Password reset successfully.You can now login."
        )

    } catch (error) {
        console.error('Reset password error:' , error.message)
        return sendError(
            res,
            'Something went wrong',       
            "RESET_PASSWORD_FAILED",
            500,
        )
    }
})



module.exports = router