const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users');

router.post('/login', usersController.login.bind(usersController));
router.get('/openid/:openid', usersController.getUser.bind(usersController));
router.post('/', usersController.createUser.bind(usersController));
router.put('/:id', usersController.updateUser.bind(usersController));

module.exports = router;
