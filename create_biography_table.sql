-- SQL to create the Biography table in the Media database
CREATE TABLE IF NOT EXISTS Biography (
    biography_id INT AUTO_INCREMENT PRIMARY KEY,
    musician_id INT NOT NULL,
    biography TEXT,
    picture VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (musician_id) REFERENCES musicians(musician_id)
);