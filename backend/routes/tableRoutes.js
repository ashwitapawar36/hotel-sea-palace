const express = require('express');
const { listTables } = require('../controllers/tableController');

const router = express.Router();

router.get('/', listTables);

module.exports = router;
