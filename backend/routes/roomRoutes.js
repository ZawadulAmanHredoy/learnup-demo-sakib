const express = require('express');
const router = express.Router();
const {
  createRoom,
  getRoomByPin,
  getRoomState,
  exportRoomResults,
} = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createRoom);
router.get('/:pin', getRoomByPin);
router.get('/:pin/state', getRoomState);
router.get('/:pin/export', exportRoomResults);

module.exports = router;
