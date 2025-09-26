const User = require('../models/user');

class UserDAO {
  async crearUsuario(data) {
    const user = new User(data);
    return await user.save();
  }

  async buscarPorUsername(username) {
    return await User.findOne({ username });
  }

  async buscarPorEmail(email) {
    return await User.findOne({ email });
  }

  async buscarPorId(id) {
    return await User.findById(id);
  }
}

module.exports = new UserDAO();
