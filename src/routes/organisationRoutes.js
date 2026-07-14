const express = require("express")
const router = express.Router()
const pool = require("../db")
const {protect , requireAdmin} = require('../middleware/auth')
const {sendSuccess , sendError} = require('../utils/response')


 
router.get('/me', protect, async (req, res) => {
  try {

    const { organisationId } = req.user

    const result = await pool.query(
      `SELECT
         o.*,
         COUNT(u.id) AS member_count
       FROM organisations o
       LEFT JOIN users u ON u.organisation_id = o.id
       AND u.is_active = true
       WHERE o.id = $1
       GROUP BY o.id`,
      [organisationId]
    )
     

    if (!result.rows[0]) {
      return sendError(
        res, 
        'Organisation not found',
        'ORG_NOT_FOUND',
        404
      )
    }

    return sendSuccess(res, { organisation: result.rows[0] })

  } catch (error) {
    console.error('Get organisation error:', error.message)
    return sendError(
        res, 
        'Failed to fetch organisation',
        'FETCH_ORG_FAILED',
        500
    )
  }
})


router.put('/me', protect, requireRole('owner'), async (req, res) => {
  try {

    const { organisationId } = req.user
    const { name } = req.body

    if (!name) {
      return sendError(
        res, 
        'Name is required',
        'VALIDATION_ERROR',
        400,
    )
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const existingOrg = await pool.query(
      'SELECT id FROM organisations WHERE slug = $1 AND id != $2',
      [slug, organisationId]
    )

    if (existingOrg.rows[0]) {
      return sendError(
        res,
        'An organisation with a similar name already exists',
        'DUPLICATE_ORG',
        400
      )
    }

    const result = await pool.query(
      `UPDATE organisations
       SET name       = $1,
           slug       = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [name, slug, organisationId]
    )

    return sendSuccess(
      res,
      { organisation: result.rows[0] },
      'Organisation updated successfully'
    )

  } catch (error) {
    console.error('Update organisation error:', error.message)
    return sendError(
        res, 
        'Failed to update organisation',
          'UPDATE_ORG_FAILED',
          500,)
  }
})


router.delete('/me', protect, requireRole('owner'), async (req, res) => {
  try {
    const { organisationId, id: userId } = req.user
    const { password, confirmName } = req.body
     
    if (!password || !confirmName) {
      return sendError(
        res,
        'Password and organisation name confirmation are required',
        'VALIDATION_ERROR',
        400
      )
    }

    
    const userResult = await pool.query(
      `SELECT
         u.password,
         o.name AS organisation_name
       FROM users u
       JOIN organisations o ON o.id = u.organisation_id
       WHERE u.id = $1`,
      [userId]
    )

    const owner = userResult.rows[0]

    const passwordMatch = await bcrypt.compare(password, owner.password)

    if (!passwordMatch) {
      return sendError(
        res,
        'Incorrect password',
        'INVALID_PASSWORD',
        401
      )
    }

    if (confirmName !== owner.organisation_name) {
      return sendError(
        res,
        `Organisation name does not match. Please type "${owner.organisation_name}" exactly`,
        'NAME_MISMATCH',
        400
      )
    }

    await pool.query(
      'DELETE FROM organisations WHERE id = $1',
      [organisationId]
    )

    return sendSuccess(
      res,
      {},
      'Organisation permanently deleted'
    )

  } catch (error) {
    console.error('Delete organisation error:', error.message)
    return sendError(
        res, 
        'Failed to delete organisation',  
        'DELETE_ORG_FAILED',
        500
        )
  }
})


module.exports = router