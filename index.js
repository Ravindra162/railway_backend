const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const mysql = require('mysql')
const {createPool} = require('mysql')
const {createTransport} = require('nodemailer')
const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
const pool = mysql.createPool({
    host:process.env.HOST,
    user:process.env.DUSER,
    password:process.env.PASSWORD,
    database:process.env.DATABASE
})



pool.query(`SELECT (1+1) AS number`,function(err,result,fields){
    if(err)throw err
    console.log('CONNECTED TO DB')
})
const PORT = 3000
app.use(cors({
    origin:'*',
    methods:['GET','POST']
}))
app.use(express.json())
const authMiddleware = (req,res,next) =>{
    const authToken = req.headers['x-access-token']
    if(authToken){
        const token = jwt.verify(authToken,process.env.JWT_SECRET)
        req.user = token
        next()
    }
    else{
        res.status(404).send('User Missed his chance')
    }

}
app.get('/',(req,res)=>{
    res.send("RailQuest Backend Nodejs API")
}
       )
app.post('/api/register', async (req, res) => {
   
    const {username, email, password} = req.body
    const role = 0;
  
    pool.query(`select email from users where email=?`,[email],(err,result,fields)=>{
        console.log(result)
        if(result.length!==0){
            res.json({message:'User Already Exists'})
        }
        else {
            pool.query(`insert into users (role,username,password,email) values (2,?,?,?)`,[username,password,email],(err,result,fields)=>{
                  if(err){
                      res.json({message:err.message})
                  }
                  return res.json({message:'Registered Successfully'})
            })
        }
    })
})
app.post('/api/login',async (req,res)=>{
    const {email,password} = req.body
    console.log(email)
    pool.query(`SELECT * FROM users WHERE email=?`,[email],(err,result,fields)=>{
       if(err) return err;
       if(result.length===0)return res.json({message:"No User Exists"})
        if(result[0]){
            if(result[0].password===password){
                const token = jwt.sign({email:email},process.env.JWT_SECRET)
                res.json({message:'Login Success',token})
            }
            else{
                res.json({message:'Incorrect Password'})
            }
        }
        else{
            res.json({message:'User Not Found'})    
        }
    })
})

app.get('/api/user',authMiddleware,(req,res)=>{
     const userEmail = req.user.email
     pool.query(`select * from users where email=?`,[userEmail],(err,result,fields)=>{
        if(err)console.log(err)
        res.json({
                username:result[0].username,
                userId:result[0].user_id,
                email:result[0].email,
                role:result[0].role
         })
     })
})


function arrangeData(trainsArray) {
    let i;
    let currentTrain = '..'; // Initialize with a dummy value
    let res = [];

    for (i = 0; i < trainsArray.length; i++) {
        if (currentTrain !== trainsArray[i].train_number) {
            // If it's a new train, push a new train object into the result array
            currentTrain = trainsArray[i].train_number;
            res.push({
                train_number: currentTrain,
                train_name: trainsArray[i].train_name,
                class_price_avail: [{
                    class: trainsArray[i].class_type,
                    available_tickets: trainsArray[i].available_tickets,
                    ticket_price: trainsArray[i].ticket_price
                }]
            });
        } else {
            // If it's the same train, find its entry in the result array and add class data
            const trainIndex = res.findIndex(train => train.train_number === currentTrain);
            res[trainIndex].class_price_avail.push({
                class: trainsArray[i].class_type,
                available_tickets: trainsArray[i].available_tickets,
                ticket_price: trainsArray[i].ticket_price
            });
        }
    }
    return res;
}


app.get('/api/search',(req,res)=>{
    const src= req.query.src
    const dest = req.query.dest
    const date = req.query.date
    console.log('source  - '+src)
    console.log('destination  - '+dest)
    console.log('date - '+date)
    pool.query(`
    SELECT  
    t1.train_number,
    t1.train_name,
    TIME(r2.arrival_time) AS sourceTime,
    DATE(r2.arrival_time) AS sourceDate,
    TIME(r1.arrival_time) AS destinationTime,
    DATE(r1.arrival_time) AS destinationDate,
    c.class_type,    
    c.seats_available AS available_tickets,    
    c.ticket_price 
    FROM trains1 t1 JOIN 
    routes1 r2 ON t1.train_number = r2.train_number JOIN routes1 r1 ON 
    r2.train_number = r1.train_number  JOIN      
    class c ON t1.train_number = c.train_number 
    WHERE r2.curr_station =? AND r1.curr_station =?    
    AND r2.stop_no < r1.stop_no  AND DATE(c.train_date) =?;

    `,[src,dest,date],(err,result,fields)=>{
       
        if(err)
        return console.log(err)
        if(result.length){
            var new_result = arrangeData(result)
            console.log(new_result[0])
            
            return res.json({
                found:true,
                trains:new_result
            })
     
    }
        console.log(false)
        return res.json({
            found:false
        })
        

    })

})

  app.post('/api/payment',authMiddleware,(req,res)=>{
    const email = req.user.email
    console.log(email)
    pool.query(`SELECT user_id from users where email=?`,[email],(err,results)=>{
        if(err) return err
        const {ticketInfo,passengers,payment} = req.body
    console.log("User - ",results[0].user_id)
    console.log(ticketInfo)
    console.log(passengers)
    console.log("payment : "+payment)
    pool.query(`
    
    INSERT INTO payment (payment_amount, date, method, user_id,status)
    VALUES (?, NOW(), ?,?,1);`,

    [ticketInfo.price*ticketInfo.passengerCount,payment,results[0].user_id],
    (err,result,fields)=>{
                    if(err)return console.log(err)
                    console.log(result.insertId)
                    res.json({
                     isDone:true,
                     payment_id:result.insertId})
                })
    })
    
  })


function generatePNR(existingNumbers) {
    const generatedPNR = Math.floor(Math.random() * (1999999999 - 100000000 + 1)) + 1000000000;

    if (existingNumbers.includes(generatedPNR)) {
        // If it exists, generate a new PNR
        return generatePNR(existingNumbers);
    } else {
        return generatedPNR;
    }
}
function generateSeat(class_type) {
    let seat;
    if (class_type === '3A') {
        seat = Math.floor(Math.random() * 64) + 1;
    } else if (class_type === '2A') {
        seat = Math.floor(Math.random() * 54) + 1;
    } else if (class_type === 'Sleeper') {
        seat = Math.floor(Math.random() * 80) + 1;
    } else if (class_type === '1A') {
        seat = Math.floor(Math.random() * 32) + 1;
    } else {

        seat = null;
    }
    return seat;
}
function generateCompartment(class_type){
    let threeTier = ['B1','B2','B3']
    let sleeperTier = ['S1','S2','S3','S4']
    let twoTier = ['A1','A2']
    let oneTier = 'H1'
    if(class_type==='3A')
    {
         return threeTier[Math.floor(Math.random()*threeTier.length)]
    }
    else if(class_type==='2A'){
        return twoTier[Math.floor(Math.random()*twoTier.length)]
    }
    else if(class_type==='1A')
    return oneTier
    else{
        return sleeperTier[Math.floor(Math.random()*sleeperTier.length)]
    }
}




app.post('/api/book-ticket', authMiddleware,async (req, res) => {
    const user = req.user.email
    pool.query(`SELECT user_id from users where email=?`,[user],(err,resultss)=>{
        const ticket = req.body.ticketDetails;
    console.log("Bookings userId : ",resultss[0].user_id)
    const passengers = req.body.passengers;
    const crucks = req.body.crucks;
    const { payment_id } = req.body;
    let receiverMail 
    const passengersList = passengers.map(passenger => passenger.passengerName).join(', ');

    pool.query(`SELECT email from users where user_id=?`,[resultss[0].user_id],(err,results)=>{
        if(err)return console.log(err)
        console.log("Email - ",results[0]);
    receiverMail = results[0].email
    })
    let passengerIds
    
    let offsetDays;
    let startDateTime;
    let endDateTime;
    let generatedPNR;
    
    pool.getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }
        
        connection.beginTransaction((err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Internal Server Error");
            }
            
            // QUERY - 1: Get offsetDays and startDateTime
            connection.query(`
                SELECT DAY(arrival_time) AS DAY,
                TIME(arrival_time) AS TIME FROM routes1 
                WHERE train_number=? AND (curr_station=? OR curr_station=?)`,
                [ticket.trainNumber, crucks.source, crucks.destination], (err, result) => {
                    if (err) {
                        console.error(err);
                        return connection.rollback(() => {
                            connection.release();
                            return res.status(500).send("Internal Server Error");
                        });
                    }

                    offsetDays = result[1].DAY - result[0].DAY;
                    console.log("Offset Days - ",offsetDays)

                    startDateTime = crucks.date + ' ' + result[0].TIME;

                    let currentMonth = parseInt(crucks.date.substr(5, 2));
                    let currentDate = parseInt(crucks.date.substr(8, 2));
                    let daysInMonth = new Date(crucks.date).getDate();
                    
                    // Calculate end date based on offset days
                    let end_date = currentDate + offsetDays;
                    console.log('end_date : ',end_date)
                   
                    endDateTime = crucks.date.substr(0, 8) + end_date + ' ' + result[1].TIME;
                    console.log('endDateTIme ',endDateTime)
                    console.log('Start Time: ', startDateTime);
                    console.log('End Time: ', endDateTime);
                    
                    // QUERY - 2: Get PNR
                    connection.query('SELECT PNR FROM ticket', (err, pnrResult) => {
                        if (err) {
                            console.error(err);
                            return connection.rollback(() => {
                                connection.release();
                                return res.status(500).send("Internal Server Error");
                            });
                        }
                        
                        generatedPNR = generatePNR(pnrResult);
                        
                        // QUERY - 3: Insert Passengers
                        connection.query('INSERT INTO passenger (first_name, last_name, age, gender, contact) VALUES ?', [passengers.map(passenger => [passenger.passengerName, passenger.passengerName, passenger.Age, passenger.Gender, passenger.ContactNo])], (err, passengerResult) => {
                            if (err) {
                                console.error(err);
                                return connection.rollback(() => {
                                    connection.release();
                                    return res.status(500).send("Internal Server Error");
                                });
                            }

                            insertedPassengerIds = [];
                            let lastInsertedId = passengerResult.insertId;
                            let numberOfPassengersInserted = passengers.length;

                            // Store the inserted IDs in the array
                            for (let i = 0; i < numberOfPassengersInserted; i++) {
                                insertedPassengerIds.push(lastInsertedId + i);
                            }
                            console.log('Passengers Inserted');
                            
                            // QUERY - 4: Insert Ticket
                            connection.query(`INSERT INTO ticket (PNR, train_number, source, destination, start_date, end_date, class, bookedBy_id, payment_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [generatedPNR, ticket.trainNumber, crucks.source, crucks.destination, startDateTime, endDateTime, ticket.class, resultss[0].user_id, payment_id], (err, ticketResult) => {
                                    if (err) {
                                        console.error(err);
                                        return connection.rollback(() => {
                                            connection.release();
                                            return res.status(500).send("Internal Server Error");
                                        });
                                    }
                                    
                                    console.log('Inserted Ticket Id: ', ticketResult.insertId);
                                    let bookingValues = [];
                                    insertedPassengerIds.forEach(passenger => {
                                        bookingValues.push({
                                            trainNumber: ticket.trainNumber,
                                            class: ticket.class,
                                            Date: startDateTime,
                                            seat: generateSeat(ticket.class),
                                            compartment: generateCompartment(ticket.class),
                                            PNR: generatedPNR,
                                            passenger_id: passenger
                                        });
                                    });
                                    console.log(bookingValues);
                                    
                                    // QUERY - 5: Insert Bookings
                                    connection.query(`INSERT INTO bookings (train_number, class_type, date, seat_number, compartment_name, PNR, passenger_id) VALUES ?`,
                                        [bookingValues.map(booking => [booking.trainNumber, booking.class, booking.Date, booking.seat, booking.compartment, booking.PNR, booking.passenger_id])], async(err, bookingResult) => {
                                            if (err) {
                                                console.error(err);
                                                return connection.rollback(() => {
                                                    connection.release();
                                                    return res.status(500).send("Internal Server Error");
                                                });
                                            }
                                            
                                            console.log('Bookings Inserted');
                                            console.log(numberOfPassengersInserted)
                                            console.log(ticket.trainNumber)
                                            console.log(startDateTime)
                                            console.log()
                                            connection.query(` UPDATE class 
                                            SET seats_available = seats_available - ?
                                            WHERE train_number = ? AND class_type = ? AND train_date = ?`,[insertedPassengerIds.length,ticket.trainNumber,ticket.class,startDateTime.slice(0,10)],(err,resultsss)=>{
                                                if (err) {
                                                    console.error(err);
                                                    return connection.rollback(() => {
                                                        connection.release();
                                                        return res.status(500).send("Internal Server Error");
                                                    });
                                                    
                                                }
                                                console.log(resultsss)
                                                connection.commit(async(err) => {
                                                    if (err) {
                                                        console.error(err);
                                                        return connection.rollback(() => {
                                                            connection.release();
                                                            return res.status(500).send("Internal Server Error");
                                                        });
                                                    }
                                                    pool.query(`
                                                    
                                                    SELECT bookings.compartment_name,
                                                    bookings.seat_number,
                                                    passenger.first_name,
                                                    passenger.age
                                                    FROM bookings INNER JOIN passenger ON bookings.passenger_id=passenger.passenger_id
                                                    WHERE passenger.passenger_id IN (?)
                                                    ;
    
                                                    `,[passengerIds],(err,mailTicketDetails)=>{
                                                        if(err)return console.log(err)
                                                        console.log(mailTicketDetails)
                                                    })
                                                    console.log('Transaction Completed');
                                                    const info = await transporter.sendMail({
                                                        from: '<RailQuestOfficial@gmail.com>', // sender address
                                                        to: receiverMail, // list of receivers
                                                        subject: "Train Ticket from RailQuest", 
                                                        text: "Hey, How's' going", 
                                                        html: `
                                                        <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RailQuest Ticket</title>
        <style>
            body {
                font-family: Arial, sans-serif;
            }
            .ticket {
                max-width: 600px;
                margin: 0 auto;
                border: 1px solid #ccc;
                padding: 20px;
                background-color: #f9f9f9;
            }
            .ticket-header {
                text-align: center;
                margin-bottom: 20px;
            }
            .ticket-details {
                margin-bottom: 20px;
            }
            .ticket-details table {
                width: 100%;
                border-collapse: collapse;
            }
            .ticket-details table th,
            .ticket-details table td {
                padding: 8px;
                border-bottom: 1px solid #ddd;
                text-align: left;
            }
            .ticket-footer {
                text-align: center;
            }
        </style>
    </head>
    <body>
    
    <div class="ticket">
        <div class="ticket-header">
            <h1>Train Ticket from RailQuest</h1>
        </div>
        <div class="ticket-details">
            <table>
                <tr>
                    <th>Train No.</th>
                    <td>${ticket.trainNumber}</td>
                </tr>
                <tr>
                    <th>Train Name</th>
                    <td>${ticket.trainName}</td> <!-- Replace with actual train name -->
                </tr>
                <tr>
                    <th>From</th>
                    <td>${crucks.source}</td>
                </tr>
                <tr>
                    <th>To</th>
                    <td>${crucks.destination}</td>
                </tr>
                <tr>
                    <th>Departure</th>
                    <td>${startDateTime}</td>
                </tr>
                <tr>
                    <th>Arrival</th>
                    <td>${endDateTime}</td>
                </tr>
                <tr>
                    <th>Class</th>
                    <td>${ticket.class}</td>
                </tr>
                <tr>
                    <th>Passenger(s)</th>
                    <td>${passengersList}</td>
                </tr>
            </table>
        </div>
        <div class="ticket-footer">
            <p>Thank you for choosing RailQuest!</p>
        </div>
    </div>
    
    </body>
    </html>
    `
    // html body
                                                      });
                                                    
                                                      console.log("Message sent: %s", info.messageId);
                                                    
                                                    connection.release();
                                                    res.status(200).send("Transaction Completed");
                                                    
                                                });
                                            })
                                            // Commit the transaction
                                         
                                        });
                                });
                        });
                    });
                });
        });
    });
    })
   
   
});



//     //Points to be done
//     // 2. ticket insertion
//     // 3. passenger insertion
//     // 4. booking insertion
//     // 5. ticket count updation in class table

app.get('/api/recent-transactions',authMiddleware,(req,res)=>{
    const userEmail = req.user.email
    pool.query(`SELECT * FROM users WHERE email=?`,[userEmail],(err,result)=>{
        if(err)throw err
        console.log(result[0])
        pool.query(`SELECT * from payment where user_id=?`,[result[0].user_id],(err,result)=>{
           res.json({
            result:result
           })
        })
    })
})

app.get('/api/recent-bookings',authMiddleware,(req,res)=>{
    const userEmail = req.user.email
    pool.query(`SELECT * FROM users WHERE email=?`,[userEmail],(err,result)=>{
        if(err)throw err
        console.log(result[0])
        pool.query(`SELECT * from ticket where bookedBy_id=?`,[result[0].user_id],(err,result)=>{
           res.json({
            result:result
           })
        })
    })
})

app.post('/api/admin/addTrain',authMiddleware,(req,res)=>{
    const {trainData,routes,compartments,classData} = req.body
    console.log(trainData)
    console.log(routes)
    console.log(compartments)
    console.log(classData)

    pool.query(`SELECT train_number from routes1 where train_number=?`,[trainData.trainNumber],(err,response)=>{
        if(response.length){
           

            res.json({
                message:'Train already exists'
            })



        }
        else{


            pool.getConnection((err,connection)=>{
                if(err)throw err
                connection.beginTransaction((err)=>{
                    if(err)return console.log(err)
                    connection.query(`INSERT INTO trains1 (train_number,train_name,source,destination) VALUES (?,?,?,?)`,
                [trainData.trainNumber,trainData.trainName,trainData.source,trainData.destination],(err,res)=>{
                        if(err){
                            return connection.rollback(() => {
                                console.error(err);
                                connection.release();
                            });
                        }
                        console.log('Inserted',res)
                        connection.query(`INSERT INTO routes1 (train_number,curr_station,stop_no,arrival_time,departure_time) values ?`,
                        [routes.map((route,index)=>{
                            if(index===routes.length-1)
                            return [trainData.trainNumber,route.stationName,route.stopNo,route.arrivalDate+' '+route.arrivalTime,null]
                            else return [trainData.trainNumber,route.stationName,route.stopNo,route.arrivalDate+' '+route.arrivalTime,route.departureDate+' '+route.departureTime]
                        })],(err,result)=>{
                            if(err) return connection.rollback(() => {
                                console.error(err);
                                connection.release();
                            });
                            console.log(result)
                          
                            connection.query(`INSERT INTO compartment (compartment_name,capacity,train_number,class_type) values ?`,
                            [compartments.map(compartment=>[compartment.compartmentName,compartment.capacity,trainData.trainNumber,compartment.class])],(err,compartments)=>{
                                if(err)return connection.rollback(() => {
                                    console.error(err);
                                    connection.release();
                                });
                                console.log(compartments)
                                connection.query(`SELECT train_number, class_type, SUM(capacity) AS total_seats_available
                                FROM compartment
                                WHERE train_number = ?
                                GROUP BY train_number, class_type;`,[trainData.trainNumber],(err,list)=>{
                                    if(err) throw err
                                    console.log(list)
                                    const getPriceFromClass = (classData, targetClass) => {
                                        const classObject = classData.find(item => item.class === targetClass);
                                        return classObject ? classObject.price : null;
                                      };
                                      for(var m=0;m<list.length;m++)
                                      connection.query(`INSERT into class (train_number,class_type,seats_available,ticket_price,train_date)
                                         values (?,?,?,?,?)`,[trainData.trainNumber,list[m].class_type,list[m].total_seats_available,getPriceFromClass(classData,list[m].class_type),trainData.startDate+' 00:00:00'],
                                         (err,done)=>{
                                            if(err)console.log(err)
                                            console.log('Class inserted - '+done)
                                         })
                                    connection.commit((err) => {
                                        if (err) {
                                            return connection.rollback(() => {
                                                console.error(err);
                                                connection.release();
                                            });
                                        }
                                        
                                        console.log('Transaction Completed');
                                        connection.release();})  
                                //     connection.query(`INSERT INTO class (train_number,class,seats_available,ticket_price,train_date)
                                //   VALUES ? 
                                //  `)
                                })
                                 
                                
                            }
                            )
                        })
                       
                })
        
                })
            })



        }
    })

    
    console.log('Hello World')
    })

app.post('/api/fetch-ticket',authMiddleware,(req,res)=>{
    console.log(req.body.PNR)
     // Example PNR number, replace it with your actual variable value
    const pnr = req.body.PNR
pool.query(`
    SELECT 
        t.train_number,
        t.source,
        t.destination,
        t.start_date,
        t.end_date,
        t.class,
        py.payment_amount,
        b.seat_number,
        b.compartment_name,
        passenger.passenger_id,
        passenger.first_name,
        passenger.last_name,
        passenger.age,
        passenger.gender,
        passenger.contact
    FROM
        ticket t
    JOIN bookings b ON t.PNR = b.PNR
    JOIN payment py ON t.payment_id = py.payment_id
    JOIN passenger ON b.passenger_id = passenger.passenger_id
    WHERE t.PNR = ?;
`, [pnr], (error, results) => {
    if (error) {
        console.error('Error fetching booking details:', error);
        throw error;
    }
    
    console.log('Booking details:', results);
    res.send(results)
});

})


app.post('/api/admin/add_date',(req,res)=>{
    console.log(req.body)
    const {trainNumber,classData,date} =  req.body
    classData.forEach(classDetail => {
        const class_type = classDetail.class;
        const ticket_price = classDetail.price;

        // Insert the class detail without specifying seats_available
        pool.query(`
            INSERT INTO class (train_number, class_type,seats_available, ticket_price, train_date)
            VALUES (?, ?,?,?, ?)
        `, [trainNumber, class_type, 10,ticket_price, date], (error, results) => {
            if (error) {
                console.error('Error inserting class detail:', error);
                return res.status(500).send('Internal Server Error');
            }
            pool.query(`
            UPDATE class c
            JOIN (
            SELECT comp.train_number, comp.class_type, SUM(comp.capacity) AS total_seats
            FROM compartment comp
            GROUP BY comp.train_number, comp.class_type
            ) comp_totals ON c.train_number = comp_totals.train_number AND c.class_type = comp_totals.class_type
            SET c.seats_available = comp_totals.total_seats WHERE c.train_date=?
            `,[date])
           console.log(results)
        });
    });
})
   


app.listen(PORT || process.env.PORT,()=>{
    console.log('Server is running on port 3000')
})
