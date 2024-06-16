require('dotenv').config();
const ejs = require("ejs")
const express = require('express');
const body_parser = require('body-parser');
const session = require("express-session");
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const { use } = require('passport');
const mongoose = require('mongoose');
const request = require('request');
const { MongoClient, Binary, ObjectId } = require('mongodb');
// const { list } = require('parser');
const { Strategy } = require('passport-google-oauth20');
const app = express();
const port = 3000;
const url = 'mongodb://localhost:27017';
const dbName = 'Recordings';

app.use(body_parser.json({ limit: '50mb' }));
app.use(express.json());
app.set('view engine', 'ejs');
app.use(body_parser.urlencoded({ extended: true}));
app.use(express.static(__dirname + '/views/public'));


app.use(session({
    secret : "Mera nikka jeya secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose
.connect(process.env.DATABASE)
.then(() => {
    console.log("Database Connected");
});

const userSchema = new mongoose.Schema({
    google_client_id:  { type: String, unique: true, required: true },
    name: String,
    email: String,
    contact: Number,
    profile_pic: String,
    theme: String,
    dhan_key: String,
    zerodha_key: String,
    razorpay_id: String,
    period: String,
    start_day: String,
    Total_Positions: Number,
    Total_Holdings: Number,
    Total_Equities: Number,
    Total_FAndO: Number,
    Total_Currencies: Number,
    Total_Commodities: Number,
    Total_Trades: Number,
    Total_Brokerage: Number, //- from unrealized profit
    Biggest_Profit: Number,
    Biggest_Loss: Number,
    Best_Day_For_Trade: String,
    Best_Strategy: String,
    Best_Lot_Size: Number,
    Strategies: [[String]],
    // Positions: [], 
    // Holdings: [],
    // Calendar: []
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema);

async function findUserByGoogleClientId(googleClientId) {
    try {
      const user = await User.findOne({ google_client_id: googleClientId });
      return user;
    } catch (error) {
      console.error('Error finding user by Google Client ID:', error);
      throw error;
    }
  }

async function createUser(data) {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // January is 0!
    const year = today.getFullYear();
    const formattedToday = `${day < 10 ? '0' : ''}${day}-${month < 10 ? '0' : ''}${month}-${year}`;

    try {
        const newUser = new User({
            google_client_id: data.google_client_id,
            name: data.name,
            email: data.email,
            contact: "",
            profile_pic: data.profile_pic,
            theme: "dark",
            dhan_key: "",
            zerodha_key: "",
            razorpay_id: "",
            period: "trial",
            start_day: formattedToday,
            Total_Positions: 0,
            Total_Holdings: 0,
            Total_Equities: 0,
            Total_FAndO: 0,
            Total_Currencies: 0,
            Total_Commodities: 0,
            Total_Trades: 0,
            Total_Brokerage: 0, //- from unrealized profit
            Biggest_Profit: 0,
            Biggest_Loss: 0,
            Best_Day_For_Trade: "",
            Best_Strategy: "",
            Best_Lot_Size: 0,
            Strategies: [],
            // Positions: [], 
            // Holdings: [],
            // Calendar: []
        });

        const savedUser = await newUser.save();
        return savedUser;
    } catch (error) {
        console.error('Error creating user:', error);
        return "";
    }
}

// passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(id, done) {
    done(null, id);
});

passport.use("google", new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/ShareLog",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  async function(accessToken, refreshToken, profile, cb) {
    console.log(profile)
    // res.redirect("/Dashboard")
    try {
        findUserByGoogleClientId(profile.id)
        .then(user => {
            if (user) {
            console.log('Found user:', user);
            cb(null, user)
            } else {
            console.log('User not found.');
            
            var data= {
                google_client_id: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                profile_pic: profile.photos[0].value,
            }

            createUser(data)
            .then(newUser => {
                console.log('New user created:', newUser);
                cb(null, newUser);
            })
            .catch(error => {
                console.error('Error:', error);
            });
                
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
    catch {
        console.log("Lulla")
    }
  }
));


app.get('/auth/google',
  passport.authenticate("google", 
  { scope: ['profile', 'email'] }
  ));

app.get('/auth/google/ShareLog', 
  passport.authenticate('google', { 
    successRedirect: "/HandleNew",
    failureRedirect: '/Signin' }),
  function(req, res) {
    // Successful authentication, redirect home.
    const googleClientId = req.user.googleClientId; // Assuming req.user contains user data from authentication
    req.session.googleClientId = googleClientId;
    res.redirect('/Dashboard');
  }
);

app.get("/HandleNew", function (req, res) {
    if(String(req.session.passport.user.dhan_key).length === 0) {
        // User with no zerodha key. Should redirect to Welcome page
        res.redirect("/Welcome");
    }
    else{
        // Redirect to Dashboard directly
        res.redirect("/Dashboard")
    }
})

app.get("/logout", function (req, res) {
    req.session.destroy(function (err) {
        res.redirect('/');
    });
})

// app.get("/tryUser", function (req, res) {
//     var newUser= new User({
//         google_client_id: req.session.passport.user.google_client_id,
//         name: "Piyush Khanna",
//         email: "piyushb@gmail",
//         contact: 8755122371,
//         profile_pic: "www.google.com",
//         theme: "dark",
//         dhan_key: "Dhan-cdsdcsd",
//         zerodha_key: "Zero-csdcsdc",
//         period: "permanent",
//         Total_Positions: 321,
//         Total_Holdings: 3222,
//         Total_Equities: 3123,
//         Total_FAndO: 22,
//         Total_Currencies: 1,
//         Total_Commodities: 121,
//         Total_Trades: 2121,
//         Total_Brokerage: 121, //- from unrealized profit
//         Biggest_Profit: 21111,
//         Biggest_Loss: 21,
//         Best_Day_For_Trade: "Monday",
//         Best_Strategy: "Trendline",
//         Best_Lot_Size: 123123,
//         Strategies: [["Trendline", "trend desc"], ["Khanna-Strat", "khanna-desc"]],
//     });
//     newUser.save()
//     .then(function (models) {
//         if(models) {
//             // console.log("Added Successfully!");
//             console.log("User saved");
//             res.redirect("/");
//         }
//     })
//     .catch( function (err) {
//         console.log(err);
//         res.send("Pehle se hi hai")
//     });
// })

app.get("/", function(req, res) {
    console.log(req.user);
    if(req.isAuthenticated()) {
        console.log("Apna hi launda hai.")
        res.redirect("/Dashboard")
    } else {
        console.log("Jabardasti ki entry");
        res.redirect("/Home")
    }
})

app.post("/razorpayCallback", async function (req, res) {
    console.log(req.body.razorpay_payment_id);
    try {
        const doc = await User.findOne({ google_client_id: req.session.passport.user.google_client_id });

        if (doc) {
            doc.razorpay_id= req.body.razorpay_payment_id;
            doc.period= "permanent";
            await doc.save(); // Save the changes
            console.log("Successfully updated 'razorpay id'");
        } else {
            console.log("Document with google_id not found.");
        }
    } catch (error) {
        console.error("Error updating 'zerodha_id':", error);
    }
    res.redirect("/Dashboard")
})

function getDateObjectFromString(dateString) {
    // Split the date string into day, month, and year
    const [day, month, year] = dateString.split('-').map(Number);

    // Create a new Date object with the given day, month, and year
    return new Date(year, month - 1, day);
}

app.get("/Dashboard", (req, res)=>{

    if(req.isAuthenticated()) {
        const ttoday = new Date();
        const tday = ttoday.getDate();
        const tmonth = ttoday.getMonth() + 1; // January is 0!
        const tyear = ttoday.getFullYear();

        // Format today's date as DD-MM-YYYY
        const tformattedToday = `${tday < 10 ? '0' : ''}${tday}-${tmonth < 10 ? '0' : ''}${tmonth}-${tyear}`;

        const date1 = getDateObjectFromString(req.session.passport.user.start_day);
        const date2 = getDateObjectFromString(tformattedToday);

        const differenceInMilliseconds = Math.abs(date1 - date2);
        const differenceInDays = 14- Math.ceil(differenceInMilliseconds / (1000 * 60 * 60 * 24));

        console.log(`Days left= ${differenceInDays}`);


        const currentDate = new Date();
        const monthNames = [
        "Jan", "Feb", "Mar",
        "Apr", "May", "Jun", "Jul",
        "Aug", "Sept", "Oct",
        "Nov", "Dec"
        ];
        const day = currentDate.getDate();
        const monthIndex = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const dayy= currentDate.getDay();
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        console.log(req.session.passport.user.google_client_id);
        console.log(req.session.passport.user.name);
        const formattedDate = `${day} ${monthNames[monthIndex]}, ${year}`;

        //! Get these data in real time from the API
        /* 
            formattedDate ki jagah date of buying stuff from database
            Type: Holdings hain ya Position
        */

            const googleClientId= req.session.passport.user.google_client_id;
            var themeThis= "none";
            getThemeById(googleClientId)
            .then(theme => {
                // console.log("Strategies:", strategies);
                themeThis= theme;
                // console.log("Theme this:"+ themeThis);
                res.render("Dashboard.ejs", {
                    theme: themeThis,
                    imgSrc: req.session.passport.user.profile_pic,
                    PageTitle: "Dashboard",
                    Name: req.session.passport.user.name.split(" ")[0],
                    DateBought: formattedDate,
                    DayBought: dayNames[dayy],
                    TypePosOrHold: "P&L",
                    PAndL: "+2500.00",
                    TotStrats: 5,
                    TotPos: 7,
                    TotHolds: 59,
                    Amount: "+2980.50"
                });
            })
            .catch(err => {
                console.error("Error:", err);
            });    

    } else {
        console.log("Jabardasti ki entry");
        res.redirect("/Home")
    }
})

app.get("/Portfolio", (req, res)=>{

    if(req.isAuthenticated()) {
        console.log("Profile me: "+ req.session.passport.user.google_client_id);
        const googleClientId= req.session.passport.user.google_client_id;
        var themeThis= "none";
        getThemeById(googleClientId)
        .then(theme => {
            // console.log("Strategies:", strategies);
            themeThis= theme;
            console.log("Theme this:"+ themeThis);
            res.render("Portfolio.ejs", 
            {
                theme: themeThis,
                imgSrc: req.session.passport.user.profile_pic,
                PageTitle: "Portfolio",
                Name: req.session.passport.user.name.split(" ")[0],
                PAndL: "50,000",
                BestStrat: "Trendline",
                NumTrads: 23,
                TotBrokerage: "20,000",
            });
        })
        .catch(err => {
            console.error("Error:", err);
        });
    } else {
        res.redirect("/Home")
    }
})

app.get("/Positions", (req, res)=>
{ 
    if(req.isAuthenticated()) {
        //! Check for new Positions bought, add them to DB. 
        //! Check if it is equity/future etc and add to total number
        //! Add to calendar equity/futures for the day
        //! Add in total brokerage
        //! Add in total brokerage
        //! If max profit, update also best day for trading, best strategy, best Lot Size
        //! Check if max loss
        // const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7','Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7','Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7','Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7'];
        console.log("Position me: "+ req.session.passport.user.google_client_id);
        const options = {
            method: 'GET',
            url: 'https://api.dhan.co/positions',
            headers: {'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzEzODc0NTY2LCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.d2Bu7gDAE5u7WPT-VQ4LAq-stLgSNKHOB92aXSFZNCUQkRa9x5sB5c9XA6rHXzUTYstm-qENS5ijVUIMH1et1g', Accept: 'application/json'}
        };
        
        var items= []
        request(options, function (error, response, body) {
            console.log(JSON.parse(body));
            if (error) throw new Error(error);
            items= JSON.parse(body);
            if(items.length == 0)
            {
                items= []
            }
            else
                items= items.concat(JSON.parse(body));
            items= JSON.parse(body);

            var hasRecording = new Boolean(0);
            const googleClientId= req.session.passport.user.google_client_id;
            var themeThis= "none";
            getThemeById(googleClientId)
            .then(theme => {
                // console.log("Strategies:", strategies);
                themeThis= theme;
                // console.log("Theme this:"+ themeThis);
                res.render("Positions.ejs", 
                {
                    theme: themeThis,
                    imgSrc: req.session.passport.user.profile_pic,
                    PageTitle: "Positions",
                    Name: req.session.passport.user.name.split(" ")[0],
                    list: items, 
                    isavailable: hasRecording
                });
            })
            .catch(err => {
                console.error("Error:", err);
            });
            
        
        });

    } else {
        res.redirect("/Home")
    }    
})

app.get("/Holdings", (req, res)=>{
    
    if(req.isAuthenticated()) {
        var items= []
    
        const options = {
            method: 'GET',
            url: 'https://api.dhan.co/holdings',
            headers: {'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzEzODc0NTY2LCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.d2Bu7gDAE5u7WPT-VQ4LAq-stLgSNKHOB92aXSFZNCUQkRa9x5sB5c9XA6rHXzUTYstm-qENS5ijVUIMH1et1g', Accept: 'application/json'}
        };

        
        request(options, function (error, response, body) {
            if (error) throw new Error(error);
            console.log(JSON.parse(body));
            if(JSON.parse(body).httpStatus ==  "BAD_REQUEST")
            {
                items= []
            }
            else
                items= items.concat(JSON.parse(body));
            // items.push({
            //     "dhanClientId": "12456466",
            //     "tradingSymbol": "TVS ke stocks",
            //     "securityId": "567132",
            //     "positionType": "LONG",
            //     "exchangeSegment": "NSE_EQ",
            //     "productType": "CNC",
            //     "buyAvg": 0,
            //     "costPrice": 0,
            //     "buyQty": 0,
            //     "sellAvg": 0,
            //     "sellQty": 0,
            //     "netQty": 0,
            //     "realizedProfit": 0,
            //     "unrealizedProfit": 0,
            //     "rbiReferenceRate": 0,
            //     "multiplier": 0,
            //     "carryForwardBuyQty": 0,
            //     "carryForwardSellQty": 0,
            //     "carryForwardBuyValue": 0,
            //     "carryForwardSellValue": 0,
            //     "dayBuyQty": 0,
            //     "daySellQty": 0,
            //     "dayBuyValue": 0,
            //     "daySellValue": 0,
            //     "drvExpiryDate": "string",
            //     "drvOptionType": "CALL",
            //     "drvStrikePrice": 0,
            //     "crossCurrency": true
            // });

            var hasRecording = new Boolean(0);
            const googleClientId= req.session.passport.user.google_client_id;
            var themeThis= "none";
            getThemeById(googleClientId)
            .then(theme => {
                // console.log("Strategies:", strategies);
                themeThis= theme;
                // console.log("Theme this:"+ themeThis);
                res.render("Holdings.ejs", 
                {
                    theme: themeThis,
                    imgSrc: req.session.passport.user.profile_pic,
                    PageTitle: "Holdings",
                    Name: req.session.passport.user.name.split(" ")[0],
                    list: items, 
                    isavailable: hasRecording
                });
            })
            .catch(err => {
                console.error("Error:", err);
            });
            
        });

    } else {
        res.redirect("/Home")
    }    
})

app.get("/Overview-Report", (req, res)=>{

    if(req.isAuthenticated()) {
        var themeThis= "none";
        const googleClientId= req.session.passport.user.google_client_id;
            getThemeById(googleClientId)
            .then(theme => {
                // console.log("Strategies:", strategies);
                themeThis= theme;
                res.render("Overview-Report.ejs", 
                {
                    theme: themeThis,
                    imgSrc: req.session.passport.user.profile_pic,
                    PageTitle: "Overview Report",
                    Name: req.session.passport.user.name.split(" ")[0],
                    AccBalance: "12,340.5",
                    CumRet: "120.5",
                    NonCumRet: "230.5",
                    DaiRet: "1,340.5",
                    RetWin: "1,234.5",
                    RetLoss: "2,300",
                    BigPro: "2,300",
                    BigLoss: "120"
                });
            })
            .catch(err => {
                console.error("Error:", err);
            });
    } else {
        res.redirect("/Home")
    }    
})

app.get("/Setup-Report", (req, res)=>{
    if(req.isAuthenticated()) {
        console.log("Profile me: "+ req.session.passport.user.google_client_id);
        const googleClientId= req.session.passport.user.google_client_id;
        var themeThis= "none";

        let data= [
            ["Monday", "12-04-2024", 12, 12, 12, 12, 12, 12, 12, 12],
            ["Tuesday", "13-04-2024", 12, 13, 15, 2, 12, 12, 12, 12],
            ["Wednesday", "14-04-2024",  12, 12, 52, 12, 12, 12, 12, 12],
            ["Thursday", "15-04-2024", 12, 62, 12, 12, 12, 12, 12, 12],
            ["Friday", "16-04-2024", 12, 32, 12, 12, 16, 12, 12, 12]
        ]

        getThemeById(googleClientId)
        .then(theme => {
            // console.log("Strategies:", strategies);
            themeThis= theme;
            console.log("Theme this:"+ themeThis);
            res.render("Setup-Report.ejs", 
            {
                theme: themeThis,
                imgSrc: req.session.passport.user.profile_pic,
                PageTitle: "Setup-Report",
                data: data,
                Name: req.session.passport.user.name.split(" ")[0],
                PAndL: "50,000",
                BestStrat: "Trendline",
                NumTrads: 23,
                TotBrokerage: "20,000",
            });
        })
        .catch(err => {
            console.error("Error:", err);
        });
    } else {
        res.redirect("/Home")
    }
})

app.post('/saveAudio', async (req, res) => {
    try {
      const client = new MongoClient(url, { useUnifiedTopology: true });
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection('Audio_Binary');
      console.log(req.body);
      // Decode base64-encoded audio data
      const audioBuffer = Buffer.from(req.body.audioData, 'base64');
  
      
      const audioBinary = new Binary(audioBuffer);
  
      // Insert binary data into MongoDB
      await collection.insertOne({ audio: audioBinary , myId: "1"});
  
      client.close();
      
      res.status(200).send('Audio saved successfully');
    } catch (error) {
      console.error('Error saving audio:', error);
      res.status(500).send('Error saving audio');
    }
  });

  app.get('/playAudio', async (req, res) => {
    try {
      const client = new MongoClient(url, { useUnifiedTopology: true });
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection('Audio_Binary');
      const objectid = new ObjectId("66144a749f873a20481e401e")
  
      // Fetch the audio data from MongoDB
      const audioData = await collection.findOne({myId: "1"});
  
      client.close();
  
      if (!audioData) {
        res.status(404).send('No audio data found');
        return;
      }
  
      // Send the audio data back to the client
      res.status(200).send(audioData.audio.buffer);
    } catch (error) {
      console.error('Error playing audio:', error);
      res.status(500).send('Error playing audio');
    }
  });
  

app.get("/ShareLog-Analysis", (req, res)=>{

    if(req.isAuthenticated()) {
        var themeThis= "none";
        const googleClientId= req.session.passport.user.google_client_id;
            getThemeById(googleClientId)
            .then(theme => {
                themeThis= theme;
                res.render("Sharelog-Analysis.ejs", 
                {
                    theme: themeThis,
                    imgSrc: req.session.passport.user.profile_pic,
                    PageTitle: "Analysis",
                    Name: req.session.passport.user.name.split(" ")[0],
                    BestStrats: "Trendline",
                    BestTimeSlot: "Morning",
                    BestDay: "Monday",
                    BestLot: 20000,
                    BigPro: 2300,
                    BigLoss: 120
                });
            })
            .catch(err => {
                console.error("Error:", err);
            });

    } else {
        res.redirect("/Home")
    }    
})

async function getStrategiesByClientId(googleClientId) {
    try {
        // Find the user with the given google_client_id
        const user = await User.findOne({ google_client_id: googleClientId });

        if (!user) {
            // console.log("User not found");
            return []; // Return an empty array if user not found
        }

        // Access the Strategies field from the user document
        const strategies = user.Strategies;

        return strategies;
    } catch (error) {
        // console.error("Error fetching strategies:", error);
        return []; // Return an empty array in case of error
    }
}


app.get("/Strategies", (req, res)=>{
    
    if(req.isAuthenticated()) {
        var items= [];
        const googleClientId= req.session.passport.user.google_client_id;
        // const googleClientId= req.session.googleClientId;
        getStrategiesByClientId(googleClientId)
        .then(strategies => {
            items= strategies;
            var themeThis= "none";
            getThemeById(googleClientId)
            .then(theme => {
                themeThis= theme;
                res.render("Strategies.ejs", 
                {
                    theme: themeThis,
                    imgSrc: req.session.passport.user.profile_pic,
                    PageTitle: "Strategies",
                    Name: req.session.passport.user.name.split(" ")[0],
                    list: items
                });
            })
            .catch(err => {
                console.error("Error:", err);
            });
        })
        .catch(err => {
            console.error("Error:", err);
        });

    } else {
        res.redirect("/Home")
    }

    
    
})
app.post("/Strategies", async (req, res) => {

    // console.log(req.body);
    newStrat= req.body.Strat;
    newDesc= req.body.Descr;

    if(newStrat.length == 0 || newStrat==null || String(newStrat).trim().length == 0)
        res.redirect("/Strategies")
    
    else {
    
        const googleClientId= req.session.passport.user.google_client_id;
        const strategyName = newStrat; 

        try {
        
            const user = await User.findOne({ google_client_id: googleClientId });
            // console.log(user);
            if (!user) {
            return res.status(404).json({ error: 'User not found' });
            }

            if(newDesc.length == 0 || newDesc==null || String(newDesc).trim().length == 0)
                newDesc= "No description provided."

            user.Strategies.push([newStrat, newDesc]);
        
            await user.save();

        } catch (error) {
            // console.error('Error adding strategy:', error);
        }
        res.redirect("/Strategies")
    }
})

app.post("/del-strategy", async function (req, res) {
    const googleClientId= req.session.passport.user.google_client_id;
    const strategyToDelete= req.body.submitStrat;
    // console.log(strategyToDelete);
    try {
        const user = await User.findOne({ google_client_id: googleClientId });
    
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        user.Strategies = user.Strategies.filter(strategy => {
            return strategy[0] !== strategyToDelete;
        });
    
        await user.save();
        res.redirect("Strategies")
      } 
      catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
      }
})

async function getThemeById(googleClientId) {
    try {
        const user = await User.findOne({ google_client_id: googleClientId });

        if (!user) {
            return ""; 
        }

        const theme = user.theme;

        return theme;
    } catch (error) {
        return [];
    }
}

app.get("/Profile", async (req, res)=>{
    if(req.isAuthenticated()) {
        var themeThis= "none";
        const googleClientId= req.session.passport.user.google_client_id;
        // const googleClientId= req.session.googleClientId;

        try {
            // Find the document with the given 'google_id'
            const doc = await User.findOne({ google_client_id: googleClientId });
    
            res.render("Profile.ejs", 
            {
                theme: doc.theme,
                PageTitle: "Profile",
                Name: doc.name.split(" ")[0],
                imgSrc: doc.profile_pic,
                fullName: doc.name,
                dhanClientID: doc.dhan_key,
                HQClientID: doc.zerodha_key,
                userEmail: doc.email,
                userContact: doc.contact,
                accType: doc.period,
                endDate: "20th Sept, 2069"
            });

        } catch (error) {
            console.error("Error updating 'zerodha_id':", error);
        }

        // getThemeById(googleClientId)
        // .then(theme => {
        //     // console.log("Strategies:", strategies);
        //     themeThis= theme;
        //     console.log("Theme this:"+ themeThis);
            
        // })
        // .catch(err => {
        //     console.error("Error:", err);
        // });
    } else {
        res.redirect("/Home")
    }
});

app.post('/toggle', async function (req, res) {
    const dataReceived = req.body;
    console.log(dataReceived);
    const theme = dataReceived.theme;
    const clientId= req.session.passport.user.google_client_id;
    console.log(typeof(dataReceived.theme));
    try {
        
        const user = await User.findOne({ google_client_id: clientId });
        // console.log(user);
        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }
        console.log("Pehle: "+user.theme);
        user.theme= dataReceived.theme;
        console.log("Baad mein: "+user.theme);
    
        await user.save();
        getThemeById(clientId)
        .then(theme => {
            // console.log("Strategies:", strategies);
            themeThis= theme;
            res.redirect("/Profile")
        })
        .catch(err => {
            console.error("Error:", err);
        });
    } catch (error) {
        console.error('Error adding strategy:', error);
    }
});

app.get("/Signup", (req, res)=>{
    res.render("SignUp.ejs");
})

app.get("/Signin", (req, res)=>{
    res.render("SignIn.ejs");
})

app.get("/Home", (req, res)=>{
    res.render("Home.ejs");
})

app.get("/Welcome", (req, res)=>{
    res.render("Welcome.ejs", 
    {
        username: req.session.passport.user.name,
        mail: req.session.passport.user.email
    });
})

app.post("/welcome", async function (req, res) {
    console.log("Change karne ki request aayi hai bhancho: ")
    console.log(req.body); 
    try {
        const doc = await User.findOne({ google_client_id: req.session.passport.user.google_client_id });

        // If document is found, update its 'zerodha_id'
        if (doc) {
            doc.dhan_key= req.body.dhanClientId;
            doc.zerodha_key = req.body.hqClientId; 
            doc.contact = req.body.contactNumber;
            if(req.body.name.length > 0) {
                doc.name= req.body.name;
            }
            if(req.body.email.length > 0) {
                doc.email= req.body.email;
            }
            await doc.save(); // Save the changes
            console.log("Successfully updated 'zerodha_id' for google_id:");
        } else {
            console.log("Document with google_id not found.");
        }
    } catch (error) {
        console.error("Error updating 'zerodha_id':", error);
    }
    //! If req.body.accountType == permanent => redirect to buy page, else dashboard
    if(req.body.accountType == "permanent") {
        res.redirect("/Buy")
    } else {
        res.redirect("/Dashboard")
    }
})

app.get("/Buy", function (req, res) {
    res.render("Buy.ejs")
})

app.listen(port, ()=>{
    console.log(`server running on port: ${port}`)
})