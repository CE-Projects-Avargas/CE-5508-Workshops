CREATE TABLE IF NOT EXISTS Notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(100) NOT NULL,
    device_id INT NOT NULL,
    owner_type VARCHAR(50),
    owner_id INT,
    occurred_at DATETIME NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);