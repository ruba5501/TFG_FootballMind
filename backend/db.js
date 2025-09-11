const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://rubgom05:Rubaesc5501@cluster0.9zmet4b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB conectado'))
.catch(err => console.error('Error al conectar a MongoDB Atlas:', err));

module.exports = mongoose;
