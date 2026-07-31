const express = require('express');
const router = express.Router();
const favoritesController = require('../controllers/favorites');

router.post('/', favoritesController.addFavorite.bind(favoritesController));
router.delete('/', favoritesController.removeFavorite.bind(favoritesController));
router.get('/', favoritesController.getFavorites.bind(favoritesController));

module.exports = router;
