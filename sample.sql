START TRANSACTION;

-- QUERY - 1: Get offsetDays and startDateTime
SELECT DAY(arrival_time) AS DAY,
TIME(arrival_time) AS TIME FROM routes1 
WHERE train_number=? AND (curr_station=? OR curr_station=?);

-- QUERY - 2: Get PNR
SELECT PNR FROM ticket;

-- QUERY - 3: Insert Passengers
INSERT INTO passenger (first_name, last_name, age, gender, contact) 
VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), ...; -- values for each passenger

-- QUERY - 4: Insert Ticket
INSERT INTO ticket (PNR, train_number, source, destination, start_date, end_date, class, bookedBy_id, payment_id) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- QUERY - 5: Insert Bookings
INSERT INTO bookings
(train_number, class_type, date, seat_number, compartment_name, PNR, passenger_id) 
VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), ...; -- values for each booking

COMMIT;

START TRANSACTION;

-- Insert train data
INSERT INTO trains1 (train_number, train_name, source, destination) 
VALUES (?, ?, ?, ?);

-- Insert routes
INSERT INTO routes1 (train_number, curr_station, stop_no, arrival_time, departure_time) 
VALUES 
  (?, ?, ?, ?, NULL), -- for the last stop
  (?, ?, ?, ?, ?),    -- for intermediate stops, repeat for each route
  ...;                 -- repeat as necessary

-- Insert compartments
INSERT INTO compartment (compartment_name, capacity, train_number, class_type) 
VALUES 
  (?, ?, ?, ?), -- for each compartment
  ...;          -- repeat as necessary

-- Calculate total seats available for each class
SELECT train_number, class_type, SUM(capacity) AS total_seats_available
FROM compartment
WHERE train_number = ?
GROUP BY train_number, class_type;

-- Insert class data
INSERT INTO class (train_number, class_type, seats_available, ticket_price, train_date)
VALUES 
  (?, ?, ?, ?, ?), -- for each class
  ...;             -- repeat as necessary

COMMIT;

---- Triggers -------------

DELIMITER //
CREATE TRIGGER seat_decrement
AFTER INSERT on bookings
FOR EACH ROW
BEGIN
UPDATE class SET seats_available=seats_available-1
WHERE DATE(train_date)=DATE(bookings.date) AND
class=bookings.class_type AND
train_number=bookings.train_number;
end;
//
DELIMITER ;
