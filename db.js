INSERT INTO compartment (compartment_name, capacity, train_number, class_type)
VALUES
('s1', 72, '23456', 'Sleeper'),
('s2', 72, '23456', 'Sleeper'),
('s3', 72, '23456', 'Sleeper'),
('b1', 64, '23456', '3A'),
('b2', 64, '23456', '3A'),
('a1', 54, '23456', '2A'),
('h2', 18, '23456', '1A');

UPDATE class c
JOIN (
SELECT comp.train_number, comp.class_type, SUM(comp.capacity) AS total_seats
FROM compartment comp
GROUP BY comp.train_number, comp.class_type
) comp_totals ON c.train_number = comp_totals.train_number AND c.class_type = comp_totals.class_type
SET c.seats_available = comp_totals.total_seats;


