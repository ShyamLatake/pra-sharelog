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
// const { list } = require('parser');
const { Strategy } = require('passport-google-oauth20');
const app = express();
const port = 3000;

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

const chartSchema= new mongoose.Schema({
    open: [Number],
    high: [Number],
    low: [Number],
    close: [Number],
    time: [Number]
});

const posSchema = new mongoose.Schema({
    securityId: String,
    tradingSymbol: String,
    audioObject: String,
    text: String,
    posType: String,
    segmentType: String,
    costPrice: Number,
    buyQty: Number,
    profit: Number,
    brokerage: Number,
    drvExpiryDate: String,
    chart: chartSchema,
    dateOfBuy: String,
    dayOfBuy: String,
    strategyUsed: String
})

const holdSchema= new mongoose.Schema({
    securityId: String,
    tradingSymbol: String,
    audioObject: String,
    text: String,
    ISIN: String,
    buyQty: String,
    inDepos: String,
    availabelQty: Number,
    avgCostPrice: Number
})

const calSchema = new mongoose.Schema({
    securityIds: [String],
    date: String,
    equity: Number,
    fAndO: Number,
    commodity: Number,
    currency: Number,
    balance: Number
})

const userSchema = new mongoose.Schema({
    google_client_id:  { type: String, unique: true, required: true },
    name: String,
    email: String,
    contact: Number,
    profile_pic: String,
    theme: String,
    dhan_key: String,
    // zerodha_key: String,
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
    curBalance: Number,
    Positions: [posSchema], 
    Holdings: [holdSchema],
    Calendar: [calSchema],
    NetPnL: Number
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema);
const Position = new mongoose.model('Position', posSchema);
const Calendar = new mongoose.model('Calender', calSchema);

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
            // zerodha_key: "",
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
            curBalance: 0,
            Positions: [], 
            Holdings: [],
            Calendar: [],
            NetPnL: 0
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

app.get("/Dashboard", async (req, res)=>{

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
        const formattedDate = `${day} ${monthNames[monthIndex]}, ${year}`;

        //! Get these data in real time from the API
        /* 
            formattedDate ki jagah date of buying stuff from database
            Type: Holdings hain ya Position
        */

        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });
        var themeThis= user.theme;
        res.render("Dashboard.ejs", {
            theme: themeThis,
            imgSrc: req.session.passport.user.profile_pic,
            PageTitle: "Dashboard",
            Name: req.session.passport.user.name.split(" ")[0],
            DateBought: formattedDate,
            DayBought: dayNames[dayy],
            TypePosOrHold: "P&L",
            PAndL: Number(user.NetPnL).toFixed(2),
            TotStrats: user.Strategies.length,
            TotPos: user.Total_Positions,
            TotHolds: user.Total_Holdings,
            Amount: Number(user.NetPnL).toFixed(2)
        });

    } else {
        console.log("Jabardasti ki entry");
        res.redirect("/Home")
    }
})

app.get("/Portfolio", async (req, res)=>{

    if(req.isAuthenticated()) {
        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });
        var themeThis= user.theme;
        var randStrat= "None";
        if(user.Strategies.length > 0) {
            const randomIndex = Math.floor(Math.random() * user.Strategies.length);
            randStrat= user.Strategies[randomIndex][0];
        }
        res.render("Portfolio.ejs", 
        {
            theme: themeThis,
            imgSrc: req.session.passport.user.profile_pic,
            PageTitle: "Portfolio",
            Name: req.session.passport.user.name.split(" ")[0],
            PAndL: Number(user.NetPnL).toFixed(2),
            BestStrat: randStrat,
            NumTrads: user.Total_Trades,
            equity: user.Total_Equities,
            commodity: user.Total_Commodities,
            currency: user.Total_Currencies,
            fno: user.Total_FAndO,
            TotBrokerage: Number(user.Total_Brokerage).toFixed(2),
        });
    } else {
        res.redirect("/Home")
    }
})


  async function addPositionIfNotExists(userId, positionData) {
    try {
        // Find the user by their ID
        const user = await User.findOne({ google_client_id: userId });

        // If user doesn't exist, handle accordingly
        if (!user) {
            throw new Error('User not found');
        }

        // Check if a position with the given securityID already exists for the user
        const existingPosition = user.Positions.find(position => position.securityId === positionData.securityId);

        // If position doesn't exist, create a new one and add it to the Positions array
        if (!existingPosition) {
            const newPosition = new Position(positionData);
            user.Positions.push(newPosition);
            await user.save();
            console.log('New position added for user:', userId);
        } else {
            console.log('Position already exists for user:', userId);
        }
    } catch (error) {
        console.error(error);
        // Handle error
    }
}
function getLocalDayName() {
    const currentDate = new Date();
    
    // Options for formatting the date
    const options = { weekday: 'long' };
    
    // Get the local day name using toLocaleDateString
    return currentDate.toLocaleDateString('en-US', options);
}

function getLocalDate() {
    const currentDate = new Date();
    
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are zero based
    const year = currentDate.getFullYear();

    return `${year}-${month}-${day}`;
}

function getAllPositions() {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            url: 'https://api.dhan.co/positions',
            headers: {
                'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzEzODc0NTY2LCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.d2Bu7gDAE5u7WPT-VQ4LAq-stLgSNKHOB92aXSFZNCUQkRa9x5sB5c9XA6rHXzUTYstm-qENS5ijVUIMH1et1g',
                Accept: 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                resolve(body);
            }
        });
    });
}

app.get("/Positions", async(req, res)=>
{ 
    if(req.isAuthenticated()) {
        //! Check for new Positions bought, add them to DB. 
        //! Check if it is equity/future etc and add to total number
        //! Add to calendar equity/futures for the day
        //! Add in total brokerage
        //! If max profit, update also best day for trading, best strategy, best Lot Size
        //! Check if max loss
        // const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7','Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7','Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7','Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7'];
        const googleClientId= req.session.passport.user.google_client_id;

        try {
                const user = await User.findOne({ google_client_id: googleClientId });
                var accessToken= user.dhan_key;
                console.log("Position me: "+ req.session.passport.user.google_client_id);
                var options = {
                    method: 'GET',
                    url: 'https://api.dhan.co/positions',
                    headers: {'access-token': accessToken, Accept: 'application/json'}
                };
                
                var items= [];
                var errorAayiThi= false;
                request(options, function (error, response, body) {
                    try {
                        console.log(JSON.parse(body));
                        console.log("Error: "+error);
                        if (body.errorCode) 
                            throw new Error(error);

                        items= JSON.parse(body);
                        if(items.length == 0) {
                            items= []
                        }
                        else
                            items= items.concat(JSON.parse(body));
                        items= JSON.parse(body);

                        const userId = user.google_client_id;
                        const item= items[0]
                            console.log(item);

                            const hoptions = {
                                method: 'POST',
                                url: 'https://api.dhan.co/charts/intraday',
                                headers: {
                                  'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzEzODc0NTY2LCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.d2Bu7gDAE5u7WPT-VQ4LAq-stLgSNKHOB92aXSFZNCUQkRa9x5sB5c9XA6rHXzUTYstm-qENS5ijVUIMH1et1g',
                                  'Content-Type': 'application/json',
                                  Accept: 'application/json'
                                },
                                body: {securityId: item.securityId, exchangeSegment: 'NSE_FNO', instrument: 'OPTIDX'},
                                json: true
                              };
                              
                              request(hoptions, function (error, response, hbody) {
                                if (error) throw new Error(error);
                              
                                console.log(hbody);
                                const existingPos = user.Positions.find(position => position.securityId === item.securityId);
                                if(!existingPos) {
                                    if(item.realizedProfit > user.Biggest_Profit) {
                                        user.Biggest_Profit = item.realizedProfit;
                                        user.Best_Day_For_Trade = getLocalDayName();
                                        user.Best_Lot_Size = item.buyQty;
                                    }
                                    if(item.realizedProfit < user.Biggest_Loss) {
                                        user.Biggest_Loss = item.realizedProfit;
                                    }
                                    user.Total_Positions = user.Total_Positions + 1;
                                    user.Total_Trades = user.Total_Trades + 1;
                                    user.Total_Brokerage = user.Total_Brokerage + Math.abs(item.unrealizedProfit);
    
                                    if(String(item.exchangeSegment).toLowerCase().includes("fno")) {
                                        user.Total_FAndO = user.Total_FAndO + 1;
                                    }
                                    if(String(item.exchangeSegment).toLowerCase().includes("eq")) {
                                        user.Total_Equities = user.Total_Equities + 1;
                                    }
                                    if(String(item.exchangeSegment).toLowerCase().includes("currency")) {
                                        user.Total_Currencies = user.Total_Currencies + 1;
                                    }
                                    if(String(item.exchangeSegment).toLowerCase().includes("comm")) {
                                        user.Total_Commodities = user.Total_Commodities + 1;
                                    }
                                }
                                
                                
                                const equityToAdd= user.Total_Equities ;
                                const commToAdd= user.Total_Commodities;
                                const fnoToAdd= user.Total_FAndO ;
                                const currToAdd= user.Total_Currencies;
                                user.save();
                                User.findOne({ google_client_id: googleClientId })
                                .exec()
                                .then(user => {
                                    if (!user) {
                                        console.log('User not found');
                                        return;
                                    }

                                    // Find the document with the specified date
                                    return Calendar.findOne({ date: getLocalDate() }).exec()
                                        .then(calendar => {
                                            if (!calendar) {
                                                // If calendar is not found, create a new document
                                                calendar = new Calendar({
                                                    date: getLocalDate(),
                                                    equity: equityToAdd,
                                                    fAndO: fnoToAdd,
                                                    commodity: commToAdd,
                                                    currency: currToAdd,
                                                    balance: 0
                                                });
                                            }

                                            // Save the calendar document
                                            return calendar.save()
                                                .then(savedCalendar => {
                                                    console.log('Calendar saved successfully:', savedCalendar);

                                                    // Append the saved calendar to the user's calendar array
                                                    user.Calendar.push(savedCalendar);

                                                    // Save the updated user document
                                                    return user.save()
                                                        .then(savedUser => {
                                                            console.log('User updated successfully:', savedUser);
                                                        });
                                                });
                                        });
                                })
                                .catch(error => {
                                    console.error('Error:', error);
                                });

                                
                                

                                const positionData = {
                                    securityId: item.securityId,
                                    tradingSymbol: item.tradingSymbol,
                                    audioObject: null,
                                    text: "",
                                    posType: item.positionType,
                                    segmentType: item.exchangeSegment,
                                    costPrice: item.costPrice,
                                    buyQty: item.buyQty,
                                    profit: item.realizedProfit,
                                    brokerage: item.unrealizedProfit,
                                    drvExpiryDate: item.drvExpiryDate,
                                    chart: hbody,
                                    dateOfBuy: getLocalDate(),
                                    dayOfBuy: getLocalDayName(),
                                    strategyUsed: ""
                                };
                                addPositionIfNotExists(userId, positionData);

                              });

                        var hasRecording = new Boolean(0);
                        var themeThis= user.theme;
                        res.render("Positions.ejs", 
                        {
                            theme: themeThis,
                            imgSrc: req.session.passport.user.profile_pic,
                            PageTitle: "Positions",
                            Name: req.session.passport.user.name.split(" ")[0],
                            list: items, 
                            isavailable: hasRecording
                        });
                }
                catch (error) {
                    accessToken= 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzEzODc0NTY2LCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.d2Bu7gDAE5u7WPT-VQ4LAq-stLgSNKHOB92aXSFZNCUQkRa9x5sB5c9XA6rHXzUTYstm-qENS5ijVUIMH1et1g';
                    options = {
                        method: 'GET',
                        url: 'https://api.dhan.co/positions',
                        headers: {'access-token': accessToken, Accept: 'application/json'}
                    };
                    request(options, function (error, response, body) {
                        console.log(JSON.parse(body));
                        console.log("Doosre ka error: "+error);
                        if (error) {
                            errorAayiThi= true;
                            return;
                        }
                        items= JSON.parse(body);
                        if(items.length == 0) {
                            items= []
                        }
                        else
                            items= items.concat(JSON.parse(body));
                        items= JSON.parse(body);

                        // Check whether the position already exists
                        const userId = user.google_client_id;
                        const item= items[0]
                            console.log(item);

                            const hoptions = {
                                method: 'POST',
                                url: 'https://api.dhan.co/charts/intraday',
                                headers: {
                                  'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzEzODc0NTY2LCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.d2Bu7gDAE5u7WPT-VQ4LAq-stLgSNKHOB92aXSFZNCUQkRa9x5sB5c9XA6rHXzUTYstm-qENS5ijVUIMH1et1g',
                                  'Content-Type': 'application/json',
                                  Accept: 'application/json'
                                },
                                body: {securityId: item.securityId, exchangeSegment: 'NSE_FNO', instrument: 'OPTIDX'},
                                json: true
                              };
                              
                              request(hoptions, function (error, response, hbody) {
                                if (error) throw new Error(error);
                              
                                console.log(hbody);
                                
                                const existingPos = user.Positions.find(position => position.securityId === item.securityId);
                                if(!existingPos) {
                                    if(item.realizedProfit > user.Biggest_Profit) {
                                        user.Biggest_Profit = item.realizedProfit;
                                        user.Best_Day_For_Trade = getLocalDayName();
                                        user.Best_Lot_Size = item.buyQty;
                                    }
                                    if(item.realizedProfit < user.Biggest_Loss) {
                                        user.Biggest_Loss = item.realizedProfit;
                                    }
                                    user.Total_Positions = user.Total_Positions + 1;
                                    user.Total_Trades = user.Total_Trades + 1;
                                    user.Total_Brokerage = user.Total_Brokerage + Math.abs(item.unrealizedProfit);
    
                                    if(String(item.exchangeSegment).toLowerCase().includes("fno")) {
                                        user.Total_FAndO = user.Total_FAndO + 1;
                                    }
                                    if(String(item.exchangeSegment).toLowerCase().includes("eq")) {
                                        user.Total_Equities = user.Total_Equities + 1;
                                    }
                                    if(String(item.exchangeSegment).toLowerCase().includes("currency")) {
                                        user.Total_Currencies = user.Total_Currencies + 1;
                                    }
                                    if(String(item.exchangeSegment).toLowerCase().includes("comm")) {
                                        user.Total_Commodities = user.Total_Commodities + 1;
                                    }
                                }
                                
                                const equityToAdd= user.Total_Equities;
                                const commToAdd= user.Total_Commodities;
                                const fnoToAdd= user.Total_FAndO;
                                const currToAdd= user.Total_Currencies;
                                user.save();
                                
                                User.findOne({ google_client_id: googleClientId })
                                .exec()
                                .then(user => {
                                    if (!user) {
                                        console.log('User not found');
                                        return;
                                    }

                                    return Calendar.findOneAndUpdate(
                                        { date: getLocalDate() }, // Filter to find the document
                                        { $inc: { equity: equityToAdd, fAndO: fnoToAdd, commodity: commToAdd, currency: currToAdd, balance: 0 } },
                                        { upsert: true, new: true } // Options to create if not found and return the updated document
                                    )
                                    .exec()
                                    .then(async (updatedCalendar) => {
                                        console.log('Calendar updated or created successfully:', updatedCalendar);
                            
                                        // Append the updated or created calendar to the user's calendar array
                                        var existingCalendar;
                                        try {
                                            existingCalendar = user.Calendar.find(calendar => calendar.date === getLocalDate());
                                        } catch (error) {
                                            existingCalendar= false;
                                        }
                                        
                                        if(!existingCalendar)
                                            user.Calendar.push(updatedCalendar);
                            
                                        // Save the updated user document
                                        return user.save()
                                            .then(savedUser => {
                                                console.log('User updated successfully:', savedUser);
                                            });
                                    });
                                })
                                .catch(error => {
                                    console.error('Error:', error);
                                });

                                

                                const positionData = {
                                    securityId: item.securityId,
                                    tradingSymbol: item.tradingSymbol,
                                    audioObject: null,
                                    text: "",
                                    posType: item.positionType,
                                    segmentType: item.exchangeSegment,
                                    costPrice: item.costPrice,
                                    buyQty: item.buyQty,
                                    profit: item.realizedProfit,
                                    brokerage: item.unrealizedProfit,
                                    drvExpiryDate: item.drvExpiryDate,
                                    chart: hbody,
                                    dateOfBuy: getLocalDate(),
                                    dayOfBuy: getLocalDayName(),
                                    strategyUsed: ""
                                };
                                addPositionIfNotExists(userId, positionData);

                              });

                        var hasRecording = new Boolean(0);
                        var themeThis= user.theme
                        res.render("Positions.ejs", 
                        {
                            theme: themeThis,
                            imgSrc: req.session.passport.user.profile_pic,
                            PageTitle: "Positions",
                            Name: req.session.passport.user.name.split(" ")[0],
                            list: items, 
                            isavailable: hasRecording
                        });
                    });
                }
                
            });

        } catch (error) {
            
            console.log("Purani lagaani padhegi");

        }

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

function filterCalendarArray(calendarArray) {
    const filteredArray= calendarArray.map(obj => ({
        date: obj.date,
        equity: obj.equity,
        fAndO: obj.fAndO,
        commodity: obj.commodity,
        currency: obj.currency,
    }));

    filteredArray.unshift({ defaultValue: -9 });

    return filteredArray;
}

app.get("/Overview-Report", (req, res)=>{

    if(req.isAuthenticated()) {
        var themeThis= "none";
        const options = {
            method: 'GET',
            url: 'https://api.dhan.co/fundlimit',
            headers: {
              'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzEzODc0NTY2LCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.d2Bu7gDAE5u7WPT-VQ4LAq-stLgSNKHOB92aXSFZNCUQkRa9x5sB5c9XA6rHXzUTYstm-qENS5ijVUIMH1et1g',
              Accept: 'application/json'
            }
          };
          
          request(options, async function (error, response, body) {
            if (error) throw new Error(error);
          
            var k= JSON.parse(body).availabelBalance;
            const googleClientId= req.session.passport.user.google_client_id;
            const user = await User.findOne({ google_client_id: googleClientId });
            var themeThis= user.theme;

            const data= user.Calendar;
            const filteredArray = filterCalendarArray(data);
            console.log(filteredArray);
            console.log(typeof(filteredArray));

            res.render("Overview-Report.ejs", 
            {
                theme: themeThis,
                imgSrc: req.session.passport.user.profile_pic,
                PageTitle: "Overview Report",
                Name: req.session.passport.user.name.split(" ")[0],
                AccBalance: k,
                CumRet: 0,
                NonCumRet: 0,
                DaiRet: 0,
                RetWin: 0,
                RetLoss: 0,
                calData: filteredArray,
                BigPro: user.Biggest_Profit,
                BigLoss: Math.abs(Number(user.Biggest_Loss))
            });
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

app.get("/ShareLog-Analysis", async (req, res)=>{

    if(req.isAuthenticated()) {
        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });
        var themeThis= user.theme;
        var randStrat= "None";
        if(user.Strategies.length > 0) {
            const randomIndex = Math.floor(Math.random() * user.Strategies.length);
            randStrat= user.Strategies[randomIndex][0];
        }
        var busty= "None"
        if(user.Best_Day_For_Trade.length > 0)
            busty= user.Best_Day_For_Trade;

        res.render("Sharelog-Analysis.ejs", 
        {
            theme: themeThis,
            imgSrc: req.session.passport.user.profile_pic,
            PageTitle: "Analysis",
            Name: req.session.passport.user.name.split(" ")[0],
            BestStrats: randStrat,
            BestTimeSlot: "Morning",
            BestDay: busty,
            BestLot: user.Best_Lot_Size,
            BigPro: user.Biggest_Profit,
            BigLoss: user.Biggest_Loss
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
                // HQClientID: doc.zerodha_key,
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
            // doc.zerodha_key = req.body.hqClientId; 
            doc.contact = req.body.contactNumber;
            if(req.body.name.length > 0) {
                doc.name= req.body.name;
            }
            if(req.body.email.length > 0) {
                doc.email= req.body.email;
            }
            await doc.save(); // Save the changes
            console.log("Successfully uadded new user");
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