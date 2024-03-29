-- mysql -h sql.freedb.tech -P 3306 -u freedb_ravinda -p freedb_Railway  for remote connections
-- mysql -h hostname -p port_number -u username -p database_name
-- For remote DB of mysql - Use clever Cloud
-- Dates_table
 create table train_dates(id INT NOT NULL AUTO_INCREMENT,train_number varchar(20) not null,FromDateOfJourney DATE not null,ToDateOfJourney DATE not null,tickets int not null,PRI
MARY KEY (id,train_number,FromDateOfJourney,ToDateOfJourney),foreign key (train_number) references trains(train_number));
