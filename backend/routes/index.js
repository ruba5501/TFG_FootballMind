const express = require('express');
const index_router = express.Router();

index_router.get('/',(req, res)=>{
    res.status(200);
    res.render('index');
});

module.exports = index_router;