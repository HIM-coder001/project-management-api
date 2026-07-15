const express = require('express');
const router = express.Router();
const {pool} = require('../db');
const {sendSuccess , sendError} = require('../utils/response');
const {protect , requireRole} = require('../middleware/auth');

//GET /api/v1/members
router.get('/' , protect , async ( req , res) => {
    try{
        const {organisationId} = req.user;

         const result = await pool.query(
      `SELECT
         id,
         name,
         email,
         role,
         avatar_url,
         last_login_at,
         created_at
       FROM users
       WHERE organisation_id = $1
       AND is_active = true
       ORDER BY
         CASE role
           WHEN 'owner'  THEN 1
           WHEN 'admin'  THEN 2
           WHEN 'member' THEN 3
         END,
         name ASC`,
      [organisationId]
    )

    return sendSuccess(
        res,
        {
            members: result.rows,
            count: result.rows.length
        },
        'Members fetched successfully',
        200
    )
 
    }
    catch(error){
        console.error('Get members error:' , error.message)
        return sendError(
            res, 
            'Failed to fetch members',
            'FAILED_TO_FETCH_MEMBERS',
            500)

    }
})


//GET /api/v1/members/pending-invites
router.get('/pending-invites' , protect , requireRole('owner' , 'admin') , async ( req , res) => {
    try{
        const {organisationId} = req.user;

        const result = await pool.query(
            `SELECT
                i.id,
                i.email,
                i.role,
                i.expires_at,
                i.created_at,
                u.name AS invited_by_name
            FROM invitation i
            JOIN users u ON i.invited_by = u.id
            WHERE i.organisation_id = $1
            AND i.accepted_at IS NULL
            AND i.expires_at > NOW()
            ORDER BY i.created_at DESC`,
            [organisationId]
        );
        return sendSuccess(
            res,
            {
                invites: result.rows,
                count: result.rows.length
            },
            'Pending invites fetched successfully',
            200
        );
    } catch (error) {
        console.error('Get pending invites error:', error.message);
        return sendError(
            res,
            'Failed to fetch pending invites',
            'FAILED_TO_FETCH_PENDING_INVITES',
            500
        );
    }
});

//POST /api/v1/members/invite
router.post('/invite' , protect , requireRole('owner' , 'admin') , async ( req , res) => {
    try{
        const {organisationId , id: invitedBy} = req.user;
        const {email , role = 'member'} = req.body;

        if(!email){
            return sendError(
                res,
                'Email is required',
                'VALIDATION_ERROR',
                400
            );
        }

        if(!['member' , 'admin'].includes(role)){
            return sendError(
                res,
                'Role must be admin or member',
                'VALIDATION_ERROR',
                400
            );
        }

        const existingUser = await pool.query(
            `SELECT id FROM users WHERE email = $1 AND organisation_id = $2`,
            [email, organisationId]
        );

        if(existingUser.rows[0]){
            return sendError(
                res,
                'This person is already a member of your organisation',
                'ALREADY_A_MEMBER',
                400
            );
        }

        const existingInvite = await pool.query(
            `SELECT id FROM invitation WHERE email = $1 AND organisation_id = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
            [email, organisationId]
        );  

        if(existingInvite.rows[0]){
            return sendError(
                res,
                'There is already a pending invite for this email',
                'INVITE_ALREADY_SENT',
                400
            );
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        const result = await pool.query(
            `INSERT INTO invitation (email, role, token, expires_at, invited_by, organisation_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [email, role, token, expiresAt, invitedBy, organisationId]
        );

        const invitation = result.rows[0]

        console.log(`Invite link ${process.env.APP_URL}/accept-invite?token=${token} `)

        return sendSuccess(
            res,
            { invitation },
            'Invitation sent successfully',
            201
        )
    }catch(error){
        console.error('Invite member error', error.message)
        return sendError(
            res,
            'Failed to send invitation',
            'INVITE_FAILED',
            500
        )
    }})


//POST /api/v1/members/accept/:token
router.post('/accept/:token', async (req, res) => {
  try {

    const { token }              = req.params
    const { name, password }     = req.body
 

    if (!name || !password) {
      return sendError(res, 'Name and password are required', 400, 'VALIDATION_ERROR')
    }

    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400, 'VALIDATION_ERROR')
    }

 
    const inviteResult = await pool.query(
      `SELECT
         i.*,
         o.name AS organisation_name
       FROM invitations i
       JOIN organisations o ON i.organisation_id = o.id
       WHERE i.token       = $1
       AND   i.accepted_at IS NULL
       AND   i.expires_at  > NOW()`,
      [token]
    )
 

    if (!inviteResult.rows[0]) {
      return sendError(
        res,
        'This invitation is invalid or has expired',
        'INVALID_INVITE',
         400,
      )
    }

    const invitation = inviteResult.rows[0]

 
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [invitation.email]
    )

    if (existingUser.rows[0]) {
      return sendError(
        res,
        'An account with this email already exists',
        400,
        'EMAIL_TAKEN'
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const userResult = await client.query(
        `INSERT INTO users (organisation_id, name, email, password, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, role, organisation_id, created_at`,
        [invitation.organisation_id, name, invitation.email, hashedPassword, invitation.role]
  
      )

      const newUser = userResult.rows[0]

 
      await client.query(
        `UPDATE invitations
         SET accepted_at = NOW()
         WHERE id = $1`,
        [invitation.id]
      )

      await client.query('COMMIT')

      return sendSuccess(
        res,
        {
          user: newUser,
          organisation: {
            id:   invitation.organisation_id,
            name: invitation.organisation_name
          }
        },
        `Welcome to ${invitation.organisation_name}! You can now login.`,
        201
      )

    } catch (transactionError) {
      await client.query('ROLLBACK')
      throw transactionError
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Accept invite error:', error.message)
    return sendError(
        res, 
        'Failed to accept invitation',  
        'ACCEPT_INVITE_FAILED',
        500, )
  }
})


//PUT /api/v1/members/:id/role
router.put('/:id/role', protect, requireRole('owner', 'admin'), async (req, res) => {
  try {

    const { organisationId, id: requesterId, role: requesterRole } = req.user
    const { id }   = req.params
    const { role } = req.body

    if (!role) {
      return sendError(res, 'Role is required', 400, 'VALIDATION_ERROR')
    }

    if (!['admin', 'member'].includes(role)) {
      return sendError(res, 'Role must be admin or member', 400, 'VALIDATION_ERROR')
    }


    const memberResult = await pool.query(
      `SELECT id, role, name FROM users
       WHERE id              = $1
       AND   organisation_id = $2
       AND   is_active       = true`,
      [id, organisationId]
    )

    if (!memberResult.rows[0]) {
      return sendError(res, 'Member not found', 404, 'MEMBER_NOT_FOUND')
    }

    const member = memberResult.rows[0]

    if (member.role === 'owner') {
      return sendError(
        res,
        'The owner role cannot be changed',
        400,
        'CANNOT_CHANGE_OWNER'
      )
    }

    if (requesterRole === 'admin' && member.role === 'admin') {
      return sendError(
        res,
        'Admins cannot change the role of other admins',
        403,
        'FORBIDDEN'
      )
    }

    
    if (Number(id) === requesterId) {
      return sendError(
        res,
        'You cannot change your own role',
        400,
        'CANNOT_CHANGE_OWN_ROLE'
      )
    }

    const result = await pool.query(
      `UPDATE users
       SET role       = $1,
           updated_at = NOW()
       WHERE id              = $2
       AND   organisation_id = $3
       RETURNING id, name, email, role`,
      [role, id, organisationId]
    )

    return sendSuccess(
      res,
      { member: result.rows[0] },
      `${member.name}'s role updated to ${role}`
    )

  } catch (error) {
    console.error('Update role error:', error.message)
    return sendError(res, 'Failed to update role', 500, 'UPDATE_ROLE_FAILED')
  }
})

//DELETE /api/v1/members/:id
router.delete('/:id', protect, requireRole('owner', 'admin'), async (req, res) => {
  try {

    const { organisationId, id: requesterId, role: requesterRole } = req.user
    const { id } = req.params

    const memberResult = await pool.query(
      `SELECT id, name, role FROM users
       WHERE id              = $1
       AND   organisation_id = $2
       AND   is_active       = true`,
      [id, organisationId]
    )

    if (!memberResult.rows[0]) {
      return sendError(res, 'Member not found', 404, 'MEMBER_NOT_FOUND')
    }

    const member = memberResult.rows[0]
 
    if (member.role === 'owner') {
      return sendError(
        res,
        'The owner cannot be removed from the organisation',
        400,
        'CANNOT_REMOVE_OWNER'
      )
    }

    if (requesterRole === 'admin' && member.role === 'admin') {
      return sendError(
        res,
        'Admins cannot remove other admins',
        403,
        'FORBIDDEN'
      )
    }

    if (Number(id) === requesterId) {
      return sendError(
        res,
        'You cannot remove yourself from the organisation',
        400,
        'CANNOT_REMOVE_SELF'
      )
    }

    await pool.query(
      `UPDATE users
       SET is_active  = false,
           updated_at = NOW()
       WHERE id              = $1
       AND   organisation_id = $2`,
      [id, organisationId]
    )

    return sendSuccess(
      res,
      {},
      `${member.name} has been removed from the organisation`
    )

  } catch (error) {
    console.error('Remove member error:', error.message)
    return sendError(res, 'Failed to remove member', 500, 'REMOVE_MEMBER_FAILED')
  }
})


module.exports = router