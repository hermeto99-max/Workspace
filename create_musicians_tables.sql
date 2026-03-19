-- SQL to create the Musicians table
CREATE TABLE IF NOT EXISTS musicians (
  musician_id INT AUTO_INCREMENT PRIMARY KEY,
  musician_name VARCHAR(100) NOT NULL,
  musician_family_name VARCHAR(100) NOT NULL,
  instruments VARCHAR(255),
  biography_id INT,
  album_id INT,
  FOREIGN KEY (album_id) REFERENCES albums(album_id),
  FOREIGN KEY (biography_id) REFERENCES biography(biography_id)
);

-- SQL to create the Biography table if not exists
CREATE TABLE IF NOT EXISTS biography (
  biography_id INT AUTO_INCREMENT PRIMARY KEY,
  musician_id INT,
  biography_text TEXT,
  FOREIGN KEY (musician_id) REFERENCES musicians(musician_id)
);
