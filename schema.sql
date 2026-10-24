CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','officer') NOT NULL DEFAULT 'officer',
  department VARCHAR(100) DEFAULT '',
  designation VARCHAR(100) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Approved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  officer_id INT NOT NULL,
  priority ENUM('Low','Medium','High') DEFAULT 'Medium',
  status ENUM('Pending','In Progress','Completed') DEFAULT 'Pending',
  due_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  officer_id INT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason VARCHAR(300) NOT NULL,
  status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  officer_id INT NOT NULL,
  att_date DATE NOT NULL,
  check_in TIME NOT NULL,
  check_out TIME NULL,
  UNIQUE KEY one_per_day (officer_id, att_date),
  FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE
)
