require('dotenv').config();
const ejs = require("ejs")
const path = require('path')
const shortid = require('shortid')
const express = require('express');
const body_parser = require('body-parser');
const session = require("express-session");
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const { use } = require('passport');
const mongoose = require('mongoose');
const cors = require('cors')
const request = require('request');
const Razorpay = require('razorpay')
const { MongoClient, Binary, ObjectId } = require('mongodb');
// const { list } = require('parser');
const { Strategy } = require('passport-google-oauth20');
const { stat } = require('fs');
const app = express();
const port =  process.env.PORT|| 3000;

app.use(cors())
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

const chartSchema= new mongoose.Schema({
    open: [Number],
    high: [Number],
    low: [Number],
    close: [Number],
    time: [Number]
});

const audioSchema= new mongoose.Schema({
    audId: String,
    audio: {
        data: Buffer, 
        contentType: String 
    }
})

const posSchema = new mongoose.Schema({
    securityId: String,
    tradingSymbol: String,
    audioObject: audioSchema,
    text: String,
    posType: String,
    segmentType: String,
    costPrice: Number,
    buyQty: Number,
    profit: Number,
    NetPnL:Number,
    brokerage: Number,
    drvExpiryDate: String,
    chart: chartSchema,
    dateOfBuy: String,
    dayOfBuy: String,
    strategyUsed: String,
    multiplier: Number,
    curBalance: Number
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
    Best_Strategy_Rating: Number,
    Best_Lot_Size: Number,
    Strategies: [[String]],
    curBalance: Number,
    Positions: [posSchema], 
    Holdings: [holdSchema],
    Calendar: [calSchema],
    Setup: [],
    NetPnL: Number
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema);
const Position = new mongoose.model('Position', posSchema);
const Calendar = new mongoose.model('Calender', calSchema);
const Audio = mongoose.model('Audio', audioSchema);

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
            Best_Strategy_Rating: 0,
            Best_Lot_Size: 0,
            Strategies: [],
            curBalance: 0,
            Positions: [], 
            Holdings: [],
            Calendar: [],
            Setup: [],
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
    callbackURL: "https://www.sharelog.in/auth/google/ShareLog",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  async function(accessToken, refreshToken, profile, cb) {
    console.log(profile)
    // res.redirect("/Dashboard")
    try {
        findUserByGoogleClientId(profile.id)
        .then(user => {
            if (user) {
            // console.log('Found user:', user);
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

app.get("/support", function (req, res) {
    res.render("support.ejs")
})

app.get("/terms-of-use", function (req, res) {
    res.render("termsOfUse.ejs")
})

app.get("/privacy-policy", function (req, res) {
    res.render("privacy-policy.ejs")
})

app.get("/cancellation", function (req, res) {
    res.render("refund.ejs")
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

app.get('/getLogo', (req, res) => {
    console.log("Bhaang bharosa!", String(path.join(__dirname, '/views/public/test-images/logo.png')));
	res.sendFile(path.join(__dirname, '/views/public/test-images/logo.png'))
})

const razorpay = new Razorpay({
	key_id: 'rzp_live_02SQsUjFIPjm1R',
	key_secret: 'TiGnwOLjFFr2LlY9bSra3W44'
})

var mainUserId;

app.post('/verification', async (req, res) => {
	// do a validation
	const secret = 'prasheek@3062001'

	console.log(req.body)

	const crypto = require('crypto')

	const shasum = crypto.createHmac('sha256', secret)
	shasum.update(JSON.stringify(req.body))
	const digest = shasum.digest('hex')

	console.log(digest, req.headers['x-razorpay-signature'])

		console.log('request is legit')
        console.log("Body is:", req.body);
        try {
            const status= req.body.payload.order.entity.status;
            if(status == "paid") 
            {
                console.log("Entity is: ", req.body.payload.payment.entity);
                console.log("Notes are: ", req.body.payload.payment.entity.notes);
                const reqGoogId= req.body.payload.payment.entity.notes.googId;
                console.log("Printing user id in verify: ", reqGoogId);

                const doc = await User.findOne({ google_client_id: reqGoogId });
                doc.razorpay_id= String(req.body.account_id);
                doc.period= "permanent";
                await doc.save(); // Save the changes
                console.log("Successfully updated 'razorpay id'");
            }
            else {
                console.log("Bullshit ho gyi payment ki");
            }   
        } catch (error) {
            console.error("Payment failed");
            console.log("Payment failed");
        }

        res.json({ status: 'ok' })

})

app.post('/razorpay', async (req, res) => {
	const payment_capture = 1
	const amount = 199
	const currency = 'INR'

    const googId= req.session.passport.user.google_client_id;

	const options = {
		amount: amount * 100,
		currency,
        notes: {googId: googId},
		receipt: shortid.generate(),
		payment_capture
	}

	try {
		const response = await razorpay.orders.create(options)
        console.log("Bhaang bharosa!", String(path.join(__dirname, '/views/public/test-images/logo.png')));
		console.log("Response deadly: ", response)
		res.json({
			id: response.id,
			currency: response.currency,
			amount: response.amount,
            notes: response.notes
		})
	} catch (error) {
		console.log(error)
	}
})

app.post("/razorpayCallback", async function (req, res) {
    console.log(req.body.razorpay_payment_id);
    try {
        if(req.body.razorpay_payment_id == undefined || req.body.razorpay_payment_id==null || String(req.body.razorpay_payment_id).length == 0) 
        {
            console.log("Failed payment");
        }
        else
        {
            const doc = await User.findOne({ google_client_id: req.session.passport.user.google_client_id });
            doc.razorpay_id= String(req.body.razorpay_payment_id);
            doc.period= "permanent";
            await doc.save(); // Save the changes
            console.log("Successfully updated 'razorpay id'");
        }        
    } catch (error) {
        console.error("Error updating 'razorpay':", error);
    }
    res.redirect("/Dashboard")
})

function getDateObjectFromString(dateString) {
    // Split the date string into day, month, and year
    const [day, month, year] = dateString.split('-').map(Number);

    // Create a new Date object with the given day, month, and year
    return new Date(year, month - 1, day);
}

const dbName = 'Recordings';

app.post('/saveAudio', async (req, res) => {
    
    try {
        const { buttonId, audio } = req.body;

        // Convert base64 audio data to Buffer
        const audioBuffer = Buffer.from(audio, 'base64');

        // Create a new audio document
        const newAudio = new Audio({
            audId: buttonId,
            audio: {
                data: audioBuffer,
                contentType: 'audio/wav' // Example content type (adjust as needed)
            }
        });
        
        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });
        
        const index = user.Positions.findIndex(position => position._id == buttonId);

        if (index !== -1) {
            console.log('Index of position with key position ID:', index);

            await newAudio.save()
            .then(savedAudio => {
                console.log('Recording saved to MongoDB:', savedAudio);
            })
            .catch(error => {
                console.error('Error saving recording to MongoDB:', error);
            });

            user.Positions[index].audioObject = newAudio;
            await user.save();

        } else {
            console.log('No position found with key position ID:', buttonId);
        }
        
        res.status(201).send('Audio data has been successfully stored.').end();

    }
    catch (error) {
        console.error('Error saving recording to MongoDB:', error);
        res.status(500).json({ error: 'Internal server error' });
    }    

  });

  app.post('/playAudio', async (req, res) => {

    try {
        const buttId= req.body.buttonId;
        console.log("Request to look for button ID", buttId);
        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });
        const index = user.Positions.findIndex(position => position._id == buttId);
        if (index !== -1) {
            console.log('Name of position with key position ID:', user.Positions[index].tradingSymbol);
            console.log("Found an audio object corresponding: ", user.Positions[index].audioObject);
            const audioData= user.Positions[index].audioObject;
            res.status(200).send(audioData.audio.data);
        } else {
            console.log('No position found with key position ID:', buttonId);
            res.status(404).send('No audio data found');
        }
    }
    catch (error){
        console.error('Error playing audio:', error);
        res.status(500).send('Error playing audio');
    }
    
  });

function getDateForDashboard(data) {
    const date = new Date(data);

    // Get day, month, and year
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    // Array of month names
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Format the day with suffix (e.g., 1st, 2nd, 3rd)
    let dayFormatted;
    switch (day) {
        case 1:
        case 21:
        case 31:
            dayFormatted = day + "st";
            break;
        case 2:
        case 22:
            dayFormatted = day + "nd";
            break;
        case 3:
        case 23:
            dayFormatted = day + "rd";
            break;
        default:
            dayFormatted = day + "th";
    }

    // Format the date as "ddth mmm, yyyy"
    const formattedDate = `${dayFormatted} ${months[monthIndex]}, ${year}`;

    return formattedDate;
}

function getFakeChartData() {
    const Response =
    {
      "open": [
      190,
263.3,
255.9,
226.4,
230,
239,
224.45,
226.95,
219.75,
200.05,
189.7,
210.3,
195.7,
189.2,
203,
186.1,
206.8,
211.5,
201.55,
200.9,
170.65,
172.05,
170.35,
173.15,
171.95,
167.75,
167.05,
180.25,
166.6,
145.5,
158.8,
159.1,
154.7,
144.05,
135.3,
140.25,
139.75,
107.95,
108.05,
97.75,
95.45,
98.45,
96.95,
99.35,
95.65,
95.65,
93,
105.05,
99.55,
101.2,
105.8,
101.4,
93.4,
83.45,
77.55,
76.6,
76.35,
78.05,
84.05,
82.1,
86.35,
92.9,
93.1,
91.85,
88.7,
91.65,
91.85,
89.95,
108.55,
116.1,
124.75,
115.9,
110.95,
104.15,
102.3,
87.4,
89.45,
81.55,
81.75,
73.45,
76.2,
76.1,
76.15,
77.1,
83.5,
81.4,
86.45,
78.95,
78.2,
83,
85.85,
83.9,
79.25,
76.75,
75.45,
70.95,
68.4,
61.75,
58.5,
61.25,
60,
62.35,
69.3,
67.2,
66.1,
61.2,
62.35,
64,
66.35,
69.4,
71.95,
69.35,
65.2,
66.5,
67.15,
66.25,
67.85,
65,
62.45,
60.2,
60,
59.1,
53.55,
49.1,
51.05,
54.55,
53.15,
53.25,
51.1,
50.8,
52.2,
53.6,
62.6,
85.2,
81.6,
77.25,
80.65,
75.7,
77.25,
74,
68.85,
70.1,
76.95,
73.55,
73.35,
72.35,
71.5,
68.25,
75.1,
73.8,
76.7,
79,
81.6,
73.35,
72.8,
69.9,
70.05,
76.65,
72.6,
72.65,
77.45,
76.2,
76.5,
83.6,
85.35,
92.55,
90.05,
94.9,
135.4,
115.85,
118.45,
115.85,
104.3,
106.65,
108.45,
105.6,
92,
94.15,
88.95,
83.95,
69.2,
71.4,
75.2,
76.2,
76.35,
79.75,
84.25,
77.9,
85.2,
96.15,
99.7,
103.25,
99.95,
104.8,
105.5,
109.5,
100.2,
98,
107.9,
100.8,
103.75,
95.45,
88.35,
91.6,
93.25,
99.4,
101.7,
105.75,
98.4,
105.85,
104.7,
95.2,
92,
95.25,
102.35,
105.55,
99.6,
98,
95.1,
96.75,
103.3,
96.15,
94.1,
97.05,
77,
77.4,
83.9,
99.8,
93.35,
98.75,
91.85,
95.95,
98.2,
96.8,
91.9,
82.8,
94.4,
95.75,
91.3,
87.45,
96.85,
99.3,
99.4,
112.85,
98,
102.7,
106.8,
105.4,
97.8,
97.05,
103.35,
98.15,
92.7,
96.75,
99.55,
90.9,
91.35,
97.25,
92.95,
86.35,
80.1,
82.6,
88.7,
98.85,
90.5,
71.75,
50.8,
51.95,
57.1,
57.75,
69.35,
62.75,
60.2,
57.25,
62.7,
62.75,
66,
62,
53.25,
57.35,
61.1,
56.2,
59.85,
59.8,
55.75,
57.25,
55.4,
52.55,
58.2,
41.85,
34,
34,
32.15,
29.35,
34.45,
37.2,
40.9,
32.15,
31.65,
32.7,
35.85,
36.5,
35.15,
35.1,
45.9,
57.45,
48.95,
54.1,
55.15,
61.35,
62.85,
53.2,
52.6,
50.1,
52.7,
41.65,
37.1,
42.85,
39,
39.1,
39.4,
38.45,
44.2,
51.15,
46.8,
51.15,
45,
46.75,
50.4,
51.5,
55.05,
54.25,
60.15,
78.05,
77.55,
76.35,
74,
85.55,
95.35,
88.4,
91.45,
77.45,
83.75,
80.4,
60.65,
72.45,
58.55,
58.3,
51.25,
46.4,
56.35,
48.15,
51.4,
40.45,
35.6,
36.4,
35.25,
24.6,
28.8,
27.3,
14.45,
12,
15.2,
13.1,
20.7,
17.1,
18.35,
18.5,
18.75,
18.55,
18,
17.05,
18.05,
16.15,
14.6
      ],
      "high": [
      266,
280.95,
255.9,
231.75,
247.7,
239,
239.3,
233.4,
219.95,
209.95,
211.6,
210.3,
196.15,
203.95,
204.15,
211.15,
222,
216.2,
204.8,
200.9,
179.05,
184.3,
174.6,
173.8,
174.45,
172.05,
183.75,
180.25,
174.35,
172.5,
166.45,
159.75,
157,
148.05,
142.9,
142.7,
143.95,
115.75,
109.6,
105.35,
98.9,
103.3,
105.6,
102.3,
99.7,
95.65,
107.65,
106.5,
100.7,
111.65,
106.55,
102.8,
95.05,
87,
80.9,
79.5,
79.6,
83.75,
84.5,
86.35,
95.9,
95.05,
95.15,
95.1,
91.75,
93.1,
94.4,
125.5,
113.8,
127.3,
127.6,
122.9,
112.75,
109.8,
105.6,
90.1,
90.85,
82.95,
84.9,
77.5,
79.55,
78,
77.05,
83.75,
86.6,
86.65,
87.5,
80,
84.5,
87.3,
86.3,
85.85,
79.5,
78,
75.65,
73.45,
68.95,
64.65,
62.8,
62.2,
64.4,
70.15,
71.1,
69.1,
66.35,
65.4,
64,
65.95,
69.35,
72.5,
72.5,
71.1,
67.95,
69.4,
67.65,
68.3,
67.85,
65.85,
62.45,
61.05,
60.4,
59.65,
53.75,
51.25,
55.7,
57.05,
54.2,
53.75,
51.75,
53.5,
53.95,
66,
86.9,
91.9,
83.95,
83.15,
84.55,
77.95,
78.35,
76.55,
72.4,
77.95,
83.5,
75.3,
77.8,
75.05,
71.5,
78.35,
76.4,
79.8,
83.3,
86.15,
83.7,
76.7,
73.45,
72.25,
76.75,
79.3,
73.75,
77.35,
77.95,
80.95,
83.2,
87.4,
94.1,
92.55,
96.75,
124.6,
135.4,
123.55,
121,
117.95,
113.35,
112.5,
112,
107.3,
96.7,
99.05,
89.25,
86.65,
74.1,
74.75,
76.45,
78.65,
79.75,
85.3,
84.95,
85.2,
94.95,
103.5,
108.1,
105.55,
107.75,
111.55,
114.2,
111.5,
105.9,
108.7,
110,
105.55,
103.8,
100.3,
95.05,
96.35,
99,
103.55,
107.7,
106.8,
108.2,
107.1,
106.95,
100.6,
95.85,
103.15,
108.85,
107.4,
100.5,
98.9,
99.75,
107.5,
103.6,
98.5,
97.5,
99.65,
80.25,
85.45,
95.55,
104.15,
101.35,
99.55,
98.5,
100.15,
99.75,
98.95,
93.15,
95.05,
97.9,
96.85,
93.7,
96.05,
101.55,
100.15,
118.2,
115.3,
105.75,
109.4,
109.95,
105.8,
103.4,
107.55,
103.35,
99.3,
97.75,
101.7,
99.9,
94.8,
98.2,
98.5,
94.8,
87.4,
85.95,
88.75,
97.55,
98.85,
91.4,
77.55,
55.55,
56.8,
58,
70.05,
69.35,
62.85,
60.4,
63.65,
63.55,
65.4,
69.35,
62.8,
58,
61.45,
63.3,
58.7,
61.8,
60,
59.3,
61.35,
56.1,
60,
58.65,
44.95,
35.65,
35.1,
33.55,
35,
38.8,
41.95,
43.6,
32.35,
34.1,
36.5,
36.25,
36.5,
36.8,
47.8,
53.7,
58.6,
56.05,
56.1,
64.35,
71.65,
69,
57.4,
55.4,
58.5,
54.65,
43.25,
43.6,
43.45,
42.05,
39.9,
40.65,
45.95,
52.25,
52.1,
51.6,
53.7,
47.6,
52.4,
52.65,
59.35,
60.35,
61.55,
74.8,
86.25,
82.15,
81.85,
87.1,
97.5,
98.15,
92,
92.55,
84.9,
83.9,
80.4,
74.2,
88.45,
59.2,
64.4,
51.25,
58.25,
56.35,
54.4,
51.4,
40.45,
40.45,
36.55,
35.25,
27.9,
29.75,
27.3,
14.45,
20.4,
16.4,
22.15,
23.25,
20.1,
18.7,
20.9,
19.65,
19.6,
18.1,
18.95,
18.05,
16.15,
15.1
      ],
      "low": [
      166,
245.2,
227.65,
218.7,
230,
211.4,
221.35,
219.6,
192.3,
186.8,
186.75,
197.1,
184,
187.65,
182.55,
184.45,
203.1,
200.85,
194.25,
161.5,
167.95,
170.75,
157.2,
163.95,
150,
159.55,
164.8,
160.2,
145,
141,
156.9,
152.55,
139.95,
128,
133.8,
136.3,
105.55,
98.6,
92.75,
94.95,
87.5,
92.65,
96.95,
93.3,
89.7,
82.65,
91.35,
92.7,
94.65,
100.05,
97.1,
92.65,
74.8,
74.4,
76.05,
72.8,
70.05,
77.05,
80.25,
78.8,
85.75,
86.7,
86.5,
89,
86.2,
86,
88,
89.95,
104,
111.1,
115.25,
109.5,
103.4,
98.9,
83.85,
82.6,
79.5,
79.25,
72.5,
69.95,
74.3,
73.8,
72.6,
77.1,
80.95,
81.4,
78.6,
75.9,
78.2,
83,
80.6,
77.4,
76.45,
74.35,
68.2,
64.35,
61.15,
56.15,
58.5,
58.4,
58.65,
62.3,
66.05,
64.3,
61.5,
61.2,
61,
61.5,
64.85,
67.1,
67.2,
64.75,
65,
65.75,
63.9,
64.95,
64.5,
60.2,
59.35,
58.65,
53.45,
53.85,
47.6,
46.1,
51.05,
53.95,
51.3,
50.75,
49.9,
50.8,
51.55,
53.5,
62.6,
80.7,
78.4,
72.75,
74.9,
69.6,
72,
70.5,
67.25,
69.5,
72.6,
71.95,
70.7,
68.65,
66.2,
68.25,
71.1,
73.8,
75.4,
79,
73.6,
71.15,
66.75,
68.35,
70.05,
72.25,
69.2,
72.25,
74.3,
74.4,
75.3,
77.9,
83.7,
85.4,
88.5,
90.35,
113.9,
115.85,
111.85,
103.4,
104.3,
106.65,
104.8,
92.5,
90.15,
92.15,
81.15,
68.75,
68.5,
69.2,
70.8,
74.65,
74.8,
79.75,
75.3,
77.9,
85.2,
96.15,
99.05,
95.5,
99.6,
104,
103.4,
100.45,
94.5,
93.2,
99.15,
100.6,
94.35,
85.65,
88,
91.45,
93.25,
97.95,
100.3,
100.1,
98.4,
101.8,
88.25,
93.5,
90.8,
95.05,
100,
98.45,
92.1,
94.6,
95,
96.75,
91.5,
92.5,
92.9,
80.6,
72.05,
75.8,
83.9,
91.3,
93.35,
91.7,
91.85,
93.6,
94.55,
91.6,
81.8,
82.8,
94.05,
90.7,
85.5,
87.2,
96.85,
90.85,
99.4,
98.05,
97.75,
102.35,
103.7,
98.4,
92.2,
97.05,
95.15,
92.85,
91.25,
96.75,
91.05,
86.65,
89.75,
91.9,
83.15,
76.75,
80.1,
81.8,
88.15,
90.45,
69.6,
48.05,
48.5,
50.95,
52.95,
57.75,
61.4,
55.45,
56.05,
56.5,
59,
61.6,
60.4,
53.05,
53.25,
55.5,
56,
55,
58.85,
52.3,
55.3,
54.8,
51.9,
52,
40.6,
32.85,
30.2,
32,
28.2,
27,
33.3,
35.9,
32.75,
28.6,
29.4,
32.5,
33.05,
33.25,
33.5,
35.1,
41.5,
47.4,
48.7,
50.45,
54.35,
58.8,
53.25,
47.7,
49.6,
49.65,
41.45,
36.55,
35.6,
37.5,
37.8,
34.1,
38,
34.4,
42.5,
45.35,
46.8,
44.45,
42.5,
46.45,
47.95,
51,
52.95,
54.25,
57.45,
75.7,
71.4,
72.75,
72.1,
78.65,
84.15,
85.2,
79.7,
74.3,
76.95,
60.65,
58.2,
58.7,
46.05,
48.6,
41.7,
44,
46,
48.1,
41.4,
33,
32.95,
31.7,
23.65,
19,
24.65,
13.75,
7.35,
10.7,
10.05,
12.55,
16.6,
14,
15.3,
17.5,
16.8,
17.3,
16.05,
17,
15.85,
14,
14
      ],
      "close": [
      261.2,
253.05,
227.65,
226.85,
241.85,
222.15,
224.35,
219.6,
200.35,
189.15,
208,
197.75,
190.5,
201.8,
186.9,
209.05,
212.5,
202.7,
199.6,
168.5,
172.95,
170.75,
173.95,
171.7,
168.1,
163.95,
179.9,
166.6,
149.3,
155.85,
159.85,
154.85,
145.8,
135.4,
139.5,
137.9,
112.6,
106.3,
99.4,
94.95,
98.65,
97.25,
99.15,
95.75,
96.7,
91.95,
106.6,
100.95,
100.7,
107.7,
100,
93.05,
83.9,
77.95,
76.8,
76.75,
78.15,
83.75,
82.05,
86.05,
93.7,
95.05,
92,
90.6,
91.75,
92.2,
89.9,
108.95,
113.8,
123.5,
116.65,
110.5,
103.85,
102.35,
88.45,
90.1,
81,
82.2,
74.2,
76.55,
75.8,
75.65,
76.6,
82.6,
82.5,
86.5,
80.4,
78.6,
83.85,
86,
84.3,
78.15,
76.45,
75.7,
71.4,
68.25,
62.15,
58.8,
61.2,
59.7,
62.65,
69.2,
67.2,
65.6,
62.15,
62.55,
64,
65.7,
69.35,
71.8,
69.15,
65.4,
67.25,
66.3,
66,
67.6,
64.95,
62.95,
60,
59.75,
58.35,
54.1,
50.05,
51.05,
54.65,
54,
53.5,
51,
50.9,
53.05,
53.6,
60.9,
86.9,
82.2,
78.5,
81.3,
75.95,
75.85,
74.3,
70.55,
69.9,
77.95,
73.05,
73.2,
70.95,
72,
69.05,
75.15,
72.55,
76.9,
77.3,
81.95,
73.9,
72.45,
70.2,
71.5,
76,
72.7,
72.15,
77.35,
76.2,
77.75,
83.2,
84.7,
90.1,
89.9,
94,
120.75,
115.7,
119.2,
115.65,
103.4,
106.25,
108.9,
105.6,
92.85,
94.2,
92.15,
83.9,
70.5,
71.75,
74.55,
76,
75.75,
79.75,
85.3,
77.7,
85.2,
94.95,
97.75,
102,
99.6,
103,
105.8,
109.35,
100.5,
96.25,
107.15,
101.95,
104.7,
95.75,
88.25,
91.65,
93.2,
98.85,
100.3,
105.9,
100.1,
105.85,
105.35,
94.65,
94.25,
94.2,
102.7,
106.45,
98.45,
96.75,
95.9,
96.65,
103.35,
96.35,
94.1,
96.65,
80.6,
77.25,
83.2,
95.55,
92.95,
98.65,
92.05,
95.9,
98,
97.35,
92,
82.25,
95.05,
95.25,
93.05,
87.2,
96.05,
98.4,
99,
112.75,
98.75,
101.5,
107.3,
105.4,
98.5,
97.7,
104.25,
97.5,
93.3,
97,
99.1,
91.05,
92,
98.2,
93.4,
86.35,
81.1,
83.2,
88.2,
96.25,
90.45,
72.25,
50.9,
51.95,
56.8,
57.95,
69.45,
62.35,
60.1,
57.35,
62.5,
62.55,
65,
61.6,
53.15,
56.95,
61.45,
56.2,
58.65,
60.5,
55.9,
58.05,
55.35,
53.75,
57.85,
43.65,
34.15,
33.85,
32.65,
30.2,
35,
38.25,
41.95,
32.75,
31.95,
33.45,
36.45,
35.95,
34.75,
35.8,
45.75,
53.25,
49.65,
53.05,
55.25,
59.95,
62.2,
54.25,
53,
50.1,
52.7,
42.45,
36.55,
42.4,
38.7,
39.5,
38.5,
38,
43.35,
50.2,
46.6,
50.25,
44.65,
46.45,
48.7,
51,
54.2,
55.2,
60.15,
73.95,
77.25,
75.2,
74.95,
85.5,
95.8,
88.85,
91.35,
80.05,
84.9,
79.65,
63.25,
71.5,
58.7,
59.2,
50.55,
46.95,
54.75,
49.4,
51.7,
41.75,
35.75,
35.5,
35,
25.25,
27.9,
28,
14.95,
11.35,
16.2,
13.8,
21.1,
18,
18.6,
17.6,
18.3,
18.75,
17.85,
17,
17.95,
16.25,
14.6,
14.3
      ],
      "volume": [
        320265,
        346500,
        300165,
        322575,
        221970,
        234045,
        174360,
        232170,
        198615,
        151665,
        182070,
        183345,
        121770,
        112410,
        258165,
        244995,
        160920,
        273930,
        130515,
        92805,
        283830,
        157710,
        221880,
        156345,
        119280,
        265995,
        330435,
        297945,
        1009965,
        419370,
        423915,
        258495,
        462060,
        209430,
        179130,
        154725,
        223305,
        215415,
        401295,
        165165,
        264135,
        472995,
        150405,
        131055,
        135885,
        327900,
        182865,
        197355,
        107775,
        259860,
        216780,
        375525,
        169305,
        167340,
        138000,
        114000,
        181185,
        189810,
        125565,
        124155,
        70515,
        94995,
        119445,
        65310,
        181110,
        169725,
        469005,
        200190,
        596910,
        215160,
        195240,
        130095,
        88875,
        82230,
        123270,
        134490,
        115410,
        108735,
        140880,
        129975,
        199515,
        217725,
        232590,
        89835,
        201480,
        242835,
        120435,
        136755,
        124065,
        92190,
        137670,
        211440,
        152415,
        90000,
        89475,
        123810,
        196350,
        90660,
        89580,
        75315,
        73650,
        178755,
        108555,
        81285,
        72720,
        150480,
        133320,
        69240,
        194670,
        303435,
        445920,
        210675,
        168990,
        112635,
        149325,
        249555,
        320850,
        411075,
        158910,
        98700,
        277575,
        132885,
        76140,
        92115,
        128670,
        114135,
        79500,
        53340,
        50775,
        71550,
        107010,
        177120,
        74055,
        95100,
        81180,
        141645,
        75285,
        59865,
        59070,
        32445,
        49275,
        66090,
        78795,
        95550,
        56940,
        70335,
        46740,
        68205,
        98745,
        124740,
        73785,
        53850,
        56565,
        48630,
        44220,
        79500,
        38295,
        40320,
        108120,
        67965,
        40590,
        391815,
        200805,
        215340,
        76125,
        85635,
        71700,
        77970,
        109965,
        49905,
        55350,
        62850,
        62805,
        90210,
        43635,
        69855,
        38805,
        75240,
        93105,
        141000,
        239655,
        105225,
        190200,
        87690,
        90495,
        90420,
        160995,
        97260,
        153900,
        75255,
        82035,
        72165,
        55440,
        50145,
        51960,
        114540,
        45915,
        58200,
        21855,
        31680,
        30750,
        40830,
        27615,
        71730,
        72555,
        73845,
        62865,
        135885,
        56010,
        81060,
        89325,
        156450,
        84060,
        70455,
        156180,
        120420,
        259110,
        388395,
        198420,
        426915,
        548880,
        288675,
        148275,
        153000,
        249930,
        217470,
        137895,
        85650,
        81420,
        94800,
        498615,
        435285,
        657855,
        355785,
        209700,
        205890,
        275535,
        177900,
        99300,
        109665,
        114195,
        189570,
        307935,
        310005,
        180375,
        119400,
        150420,
        96750,
        154905,
        107295,
        89445,
        51360,
        56115,
        76755,
        86250,
        553605,
        267345,
        213405,
        150150,
        97005,
        71220,
        71145,
        131100,
        110925,
        153705,
        133365,
        94260,
        97620,
        66105,
        81690,
        72915,
        148365,
        99360,
        65880,
        112935,
        83580,
        231240,
        275805,
        142080,
        107760,
        102825,
        67905,
        71985,
        119160,
        157200,
        163455,
        114825,
        107385,
        74670,
        209070,
        148905,
        208920,
        114870,
        71595,
        94410,
        171210,
        137235,
        111540,
        114240,
        72270,
        97680,
        60450,
        61365,
        54525,
        131115,
        83550,
        92130,
        56475,
        234195,
        144990,
        91635,
        171105,
        115020,
        81555,
        70770,
        82305,
        88275,
        64005,
        91695,
        119445,
        320340,
        137010,
        261540,
        312390,
        129000,
        193440,
        225720,
        110955,
        146025,
        146040,
        157845,
        113715,
        128910,
        94335,
        142575,
        84240,
        98910,
        180345,
        121830,
        114135,
        118065,
        134985,
        71835,
        121470,
        296115,
        191640,
        179145,
        187695,
        92835,
        185940,
        298725,
        169965,
        236385,
        214800,
        143070,
        189735,
        182460,
        118650,
        126915,
        237255,
        381675,
        319455,
        184245,
        177105,
        187620,
        249360,
        140205,
        202920,
        192555,
        219930,
        210975,
        146670,
        198345,
        214245,
        272295
      ],
      "start_Time": [
        1396410300,
        1396410360,
        1396410420,
        1396410480,
        1396410540,
        1396410600,
        1396410660,
        1396410720,
        1396410780,
        1396410840,
        1396410900,
        1396410960,
        1396411020,
        1396411080,
        1396411140,
        1396411200,
        1396411260,
        1396411320,
        1396411380,
        1396411440,
        1396411500,
        1396411560,
        1396411620,
        1396411680,
        1396411740,
        1396411800,
        1396411860,
        1396411920,
        1396411980,
        1396412040,
        1396412100,
        1396412160,
        1396412220,
        1396412280,
        1396412340,
        1396412400,
        1396412460,
        1396412520,
        1396412580,
        1396412640,
        1396412700,
        1396412760,
        1396412820,
        1396412880,
        1396412940,
        1396413000,
        1396413060,
        1396413120,
        1396413180,
        1396413240,
        1396413300,
        1396413360,
        1396413420,
        1396413480,
        1396413540,
        1396413600,
        1396413660,
        1396413720,
        1396413780,
        1396413840,
        1396413900,
        1396413960,
        1396414020,
        1396414080,
        1396414140,
        1396414200,
        1396414260,
        1396414320,
        1396414380,
        1396414440,
        1396414500,
        1396414560,
        1396414620,
        1396414680,
        1396414740,
        1396414800,
        1396414860,
        1396414920,
        1396414980,
        1396415040,
        1396415100,
        1396415160,
        1396415220,
        1396415280,
        1396415340,
        1396415400,
        1396415460,
        1396415520,
        1396415580,
        1396415640,
        1396415700,
        1396415760,
        1396415820,
        1396415880,
        1396415940,
        1396416000,
        1396416060,
        1396416120,
        1396416180,
        1396416240,
        1396416300,
        1396416360,
        1396416420,
        1396416480,
        1396416540,
        1396416600,
        1396416660,
        1396416720,
        1396416780,
        1396416840,
        1396416900,
        1396416960,
        1396417020,
        1396417080,
        1396417140,
        1396417200,
        1396417260,
        1396417320,
        1396417380,
        1396417440,
        1396417500,
        1396417560,
        1396417620,
        1396417680,
        1396417740,
        1396417800,
        1396417860,
        1396417920,
        1396417980,
        1396418040,
        1396418100,
        1396418160,
        1396418220,
        1396418280,
        1396418340,
        1396418400,
        1396418460,
        1396418520,
        1396418580,
        1396418640,
        1396418700,
        1396418760,
        1396418820,
        1396418880,
        1396418940,
        1396419000,
        1396419060,
        1396419120,
        1396419180,
        1396419240,
        1396419300,
        1396419360,
        1396419420,
        1396419480,
        1396419540,
        1396419600,
        1396419660,
        1396419720,
        1396419780,
        1396419840,
        1396419900,
        1396419960,
        1396420020,
        1396420080,
        1396420140,
        1396420200,
        1396420260,
        1396420320,
        1396420380,
        1396420440,
        1396420500,
        1396420560,
        1396420620,
        1396420680,
        1396420740,
        1396420800,
        1396420860,
        1396420920,
        1396420980,
        1396421040,
        1396421100,
        1396421160,
        1396421220,
        1396421280,
        1396421340,
        1396421400,
        1396421460,
        1396421520,
        1396421580,
        1396421640,
        1396421700,
        1396421760,
        1396421820,
        1396421880,
        1396421940,
        1396422000,
        1396422060,
        1396422120,
        1396422180,
        1396422240,
        1396422300,
        1396422360,
        1396422420,
        1396422480,
        1396422540,
        1396422600,
        1396422660,
        1396422720,
        1396422780,
        1396422840,
        1396422900,
        1396422960,
        1396423020,
        1396423080,
        1396423140,
        1396423200,
        1396423260,
        1396423320,
        1396423380,
        1396423440,
        1396423500,
        1396423560,
        1396423620,
        1396423680,
        1396423740,
        1396423800,
        1396423860,
        1396423920,
        1396423980,
        1396424040,
        1396424100,
        1396424160,
        1396424220,
        1396424280,
        1396424340,
        1396424400,
        1396424460,
        1396424520,
        1396424580,
        1396424640,
        1396424700,
        1396424760,
        1396424820,
        1396424880,
        1396424940,
        1396425000,
        1396425060,
        1396425120,
        1396425180,
        1396425240,
        1396425300,
        1396425360,
        1396425420,
        1396425480,
        1396425540,
        1396425600,
        1396425660,
        1396425720,
        1396425780,
        1396425840,
        1396425900,
        1396425960,
        1396426020,
        1396426080,
        1396426140,
        1396426200,
        1396426260,
        1396426320,
        1396426380,
        1396426440,
        1396426500,
        1396426560,
        1396426620,
        1396426680,
        1396426740,
        1396426800,
        1396426860,
        1396426920,
        1396426980,
        1396427040,
        1396427100,
        1396427160,
        1396427220,
        1396427280,
        1396427340,
        1396427400,
        1396427460,
        1396427520,
        1396427580,
        1396427640,
        1396427700,
        1396427760,
        1396427820,
        1396427880,
        1396427940,
        1396428000,
        1396428060,
        1396428120,
        1396428180,
        1396428240,
        1396428300,
        1396428360,
        1396428420,
        1396428480,
        1396428540,
        1396428600,
        1396428660,
        1396428720,
        1396428780,
        1396428840,
        1396428900,
        1396428960,
        1396429020,
        1396429080,
        1396429140,
        1396429200,
        1396429260,
        1396429320,
        1396429380,
        1396429440,
        1396429500,
        1396429560,
        1396429620,
        1396429680,
        1396429740,
        1396429800,
        1396429860,
        1396429920,
        1396429980,
        1396430040,
        1396430100,
        1396430160,
        1396430220,
        1396430280,
        1396430340,
        1396430400,
        1396430460,
        1396430520,
        1396430580,
        1396430640,
        1396430700,
        1396430760,
        1396430820,
        1396430880,
        1396430940,
        1396431000,
        1396431060,
        1396431120,
        1396431180,
        1396431240,
        1396431300,
        1396431360,
        1396431420,
        1396431480,
        1396431540,
        1396431600,
        1396431660,
        1396431720,
        1396431780,
        1396431840,
        1396431900,
        1396431960,
        1396432020,
        1396432080,
        1396432140,
        1396432200,
        1396432260,
        1396432320,
        1396432380,
        1396432440,
        1396432500,
        1396432560,
        1396432620,
        1396432680,
        1396432740
      ]
    }

    return Response;
}
function addTenYears(chartObject) {
    // Copy the original chart object to avoid modifying the original data
    const modifiedChartObject = { ...chartObject };
  
    // Get the array of start times from the chart object
    const startTimes = modifiedChartObject.start_Time;
  
  
    for (let i = 0; i < startTimes.length; i++) {
      // Calculate the difference between the original start time and January 1, 1980
      const januaryFirst1980 = new Date('1980-01-01').getTime();
        const januaryFirst1990 = new Date('1990-01-01').getTime();

        // Calculate the difference in milliseconds between the two dates
        const millisecondsDifference = januaryFirst1990 - januaryFirst1980;

        // Convert milliseconds to seconds
        const secondsDifference = millisecondsDifference / 1000;
      startTimes[i] += (secondsDifference - (24*60*60));
    }
  
    // Update the start_Time property in the modified chart object
    modifiedChartObject.start_Time = startTimes;
  
    // Return the modified chart object
    return modifiedChartObject;
  }  

  function calculateBrokerage(productType,transactionType, quantity, pricePerLot, brokerageRate) {
    
   let  exchangeFees = 0.000495;
   const  sebiChargesRate = 0.000001;
   const  sttRate = 0.000625;
   const stampDutyRate = 0.00003;
   const  ipftChargesRate = 0.000001;
   const turnover = quantity * pricePerLot;

   let brokerage;
   if(productType !== "DELIVERY"){
     brokerage = Math.min(brokerageRate * turnover, 20);
   }

   const exchangeTransactionCharge = Math.round((exchangeFees * turnover) * 100) / 100;

   let stt = 0;

    if (transactionType === 'SELL') {
       stt = Math.round((sttRate * turnover)* 100) / 100;  
   }

   // Stamp Duty (on buy orders only)
   const stampDuty = transactionType === 'BUY' ? Math.round((stampDutyRate * turnover) * 100) / 100 : 0;

   // SEBI Charges
   const sebiFee = sebiChargesRate * turnover;

   const totalCharges = Math.round((brokerage + exchangeTransactionCharge  + sebiFee + stampDuty + stt) * 100 ) / 100 ;

   // Points to Breakeven Calculation
   const breakevenPoint = (totalCharges / quantity) + pricePerLot;
    
    return totalCharges
}

app.get("/Dashboard", async (req, res)=>{

    if(req.isAuthenticated()) {

        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });


        const startDate = user.start_day;
        const futureDate = getEndDate(startDate);
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); // January is 0
        const year = today.getFullYear();
        const todaysDate = `${day}-${month}-${year}`;
        console.log("Janaab ki aakhri date hai: ", futureDate, typeof(futureDate));
        // console.log("Aaj ki date hai: ", todaysDate, typeof(todaysDate));
        
        if (futureDate == todaysDate && user.period == "trial") {
            // Aakhri waqt aa gya
            res.redirect("/Buy")
        }
        else 
        {
        // let allPositions = await generateFakePosition();
            let allPositions = await getAllPositions();

            console.log("All Positions: ", allPositions);
            // const date = new Date('2024-05-04'); 
            // const lastDate = new Date('2024-05-16');
            // let tradeHistory = await getTradeHistory(date, lastDate);

            //! Extract and add all positions
            let i= 0;
            for (const thisPosition of allPositions) 
            {
                
                const buyBrokerageDetails = calculateBrokerage(thisPosition.productType,'BUY', thisPosition.buyQty, thisPosition.buyAvg, 0.03);
                const sellBrokerageDetails = calculateBrokerage(thisPosition.productType,'SELL', thisPosition.sellQty, thisPosition.sellAvg, 0.03);

                console.log("Sell Brokerage Details: ", sellBrokerageDetails);
                let Gst = Math.round((0.18 * (buyBrokerageDetails + sellBrokerageDetails) * 100)) / 100;
                let ift = Math.round(0.000005 * (thisPosition.buyQty * thisPosition.buyAvg + thisPosition.sellQty  * thisPosition.sellAvg) * 100) / 100;

                 thisPosition.totalTax = buyBrokerageDetails + sellBrokerageDetails + Gst + ift;
                 thisPosition.netPandL = thisPosition.realizedProfit - thisPosition.totalTax;
                 console.log("Total Brokerage: ", thisPosition.netPandL);

                let positionExists = false;
                for (const position of user.Positions) 
                {
                    if (position.securityId === thisPosition.securityId) {
                        positionExists = false;
                        console.log("Position already exists in DB. Skipping");
                        break;
                    }
                }
                if(true) 
                {
                    console.log("New position. Storing it to DB");
                    console.log("Retrieving chart for this position from Dhan");

                    var chartData;
                    try {
                        chartData= await getChartData(thisPosition.securityId , "NSE_FNO", "OPTIDX");
                    }
                    catch(err) {
                        chartData= null;
                    }

                    user.Total_Positions++;
                    user.Total_Trades++;

                    // console.log(typeof(chartData));
                    // console.log(chartData);
                    if(chartData != null && String(chartData.errorCode).toLowerCase() === "none") {
                        console.log("Chart lost as application not opened");
                        chartData= getFakeChartData();
                    } 

                    const modifiedChartObject = addTenYears(chartData);
                    
                    var huiChart= {};
                    huiChart.open= chartData.open;
                    huiChart.high= chartData.high;
                    huiChart.low= chartData.low;
                    huiChart.close= chartData.close;
                    huiChart.time= modifiedChartObject.start_Time;

                    chartData= huiChart;

                    //! Make amendments for biggest loss, profit etc
                    user.Total_Brokerage += thisPosition.unrealizedProfit;

                    if(thisPosition.realizedProfit > user.Biggest_Profit) {
                        user.Biggest_Profit = thisPosition.realizedProfit;
                        user.Best_Day_For_Trade = getLocalDayName();
                        user.Best_Lot_Size = thisPosition.buyQty;
                    }

                    if(thisPosition.realizedProfit < user.Biggest_Loss)
                        user.Biggest_Loss = thisPosition.realizedProfit;


                //! Setup charts yahaan nahi benenge kyuki is vaqt ye tey nhi hota ki konsi strategy dalegi isme

                    //! Save pos object
                    const positionData = {
                        securityId: thisPosition.securityId,
                        tradingSymbol: thisPosition.tradingSymbol,
                        audioObject: null,
                        text: "",
                        posType: thisPosition.positionType,
                        segmentType: thisPosition.exchangeSegment,
                        costPrice: Math.round(thisPosition.costPrice),
                        buyQty: thisPosition.buyQty,
                        profit: thisPosition.realizedProfit,
                        brokerage: Math.round(thisPosition.totalTax * 100) / 100,
                        NetPnL: Math.round(thisPosition.netPandL * 100) / 100,
                        drvExpiryDate: thisPosition.drvExpiryDate,
                        chart: chartData,
                        dateOfBuy: getLocalDate(),
                        dayOfBuy: getLocalDayName(),
                        strategyUsed: "",
                        multiplier: thisPosition.multiplier,
                        curBalance: await getCurBalance()
                    };

                    var newPosition = new Position(positionData);
                    user.Positions.push(newPosition);
                    await user.save();
                    console.log("Chart saved");
                }
            }

            //! Calendar Work
            for (const thisPosition of allPositions)
            {
                let posType;
                if(String(thisPosition.exchangeSegment).toLowerCase().includes("fno"))
                    posType= "fno";
                else if(String(thisPosition.exchangeSegment).toLowerCase().includes("eq"))
                    posType= "eq";
                else if(String(thisPosition.exchangeSegment).toLowerCase().includes("comm"))
                    posType= "comm";
                else if(String(thisPosition.exchangeSegment).toLowerCase().includes("curr"))
                    posType= "curr";
                
                const secId = thisPosition.securityId;

                const aajKiDateWalaObject= await findCalendarEntryForToday(user);
                console.log("Aaj ki date wala object: ", aajKiDateWalaObject);
                // console.log(aajKiDateWalaObject);
                if(typeof aajKiDateWalaObject === "string")
                {
                    console.log("Calendar object not found. Banana padega");
                    
                    //! Get Balance
                    const curBal= await getCurBalance();

                    //! make Calendar object 
                    let fno= 0, eq= 0, comm= 0, curr= 0;
                    if (posType === "fno") {
                        fno++;
                        user.Total_FAndO++;
                    }
                    else if (posType === "eq"){
                        eq++;
                        user.Total_Equities++;
                    }
                    else if (posType === "comm"){
                        comm++;
                        user.Total_Commodities++;
                    }
                    else if (posType === "curr"){
                        curr++;
                        user.Total_Currencies++;
                    }

                    const calendar = new Calendar({
                        securityIds: [secId],
                        date: getLocalDate(),
                        equity: eq,
                        fAndO: fno,
                        commodity: comm,
                        currency: curr,
                        balance: curBal
                    });

                    //! Save in user
                    await calendar.save();
                    await user.Calendar.push(calendar);
                    await user.save();
                }
                else
                {
                    console.log("Ek calendar mila hai");

                    if(!aajKiDateWalaObject.securityIds.includes(secId))
                    {
                        if (posType === "fno"){
                            aajKiDateWalaObject.fAndO++;
                            user.Total_FAndO++;
                        }
                        else if (posType === "eq"){
                            aajKiDateWalaObject.equity++;
                            user.Total_Equities++;
                        }
                        else if (posType === "comm"){
                            aajKiDateWalaObject.commodity++;
                            user.Total_Commodities++;
                        }
                        else if (posType === "curr"){
                            aajKiDateWalaObject.currency++;
                            user.Total_Currencies++;
                        }
                        
                        aajKiDateWalaObject.securityIds.push(secId);
                        await aajKiDateWalaObject.save({ suppressWarning: true });
                        await user.save();
                    }
                }
            }

         
            // console.log("user positions ", user.Positions);
            const positionsLastWeek = await filterPositionsLastWeek(user.Positions);
            console.log("Positions last week: ", user.Positions);
            
            var themeThis= user.theme;
            res.render("Dashboard.ejs", {
                theme: themeThis,
                imgSrc: req.session.passport.user.profile_pic,
                PageTitle: "Dashboard",
                Name: req.session.passport.user.name.split(" ")[0],
                // DateBought: formattedDate,
                // DayBought: dayNames[dayy],
                TypePosOrHold: "P&L",
                PAndL: Number(user.NetPnL).toFixed(2),
                TotStrats: user.Strategies.length,
                TotPos: user.Total_Positions,
                TotHolds: user.Total_Holdings,
                Amount: Number(user.NetPnL).toFixed(2),
                carouselData: positionsLastWeek,
                Strategies: user.Strategies
            });
        }   

    } else {
        console.log("Jabardasti ki entry");
        res.redirect("/Home")
    }
})

function filterPositionsLastWeek(positions) {
    // Get today's date
    const today = new Date();

    // Calculate the date 7 days ago
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Filter positions bought within the last week
    const positionsLastWeek = positions.filter(position => {
        const dateOfBuy = new Date(position.dateOfBuy);
        return dateOfBuy >= oneWeekAgo && dateOfBuy <= today;
    });

    return positionsLastWeek;
}

app.post("/getChartData", async function (req, res) {
    const posId= req.body.userID;
    const googleClientId= req.session.passport.user.google_client_id;
    const user = await User.findOne({ google_client_id: googleClientId });
    const index = user.Positions.findIndex(position => position._id == posId);
    const thisPossy= user.Positions[index];

    // console.log(thisPossy.chart);
    res.status(200).json(thisPossy.chart);
})

function convertDateFormat(date) {
    const parts = date.split('-');
    // Rearrange the parts to the desired format (MM-DD-YYYY)
    return `${parts[1]}-${parts[2]}-${parts[0]}`;
}

app.get("/Portfolio", async (req, res)=>{

    if(req.isAuthenticated()) {
        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });
        var themeThis= user.theme;
        var randStrat= "None";
        if(user.Strategies.length > 0) {
            if(user.Best_Strategy == null || user.Best_Strategy == undefined || user.Best_Strategy.length == 0)
            {
                const randomIndex = Math.floor(Math.random() * user.Strategies.length);
                randStrat= user.Strategies[randomIndex][0];
            }
            else{
                randStrat= user.Best_Strategy;
            }
        }

        const filteredCal = filterDateAndBalance(user.Calendar);
        filteredCal.forEach(obj => {
            obj.date = convertDateFormat(obj.date);
        });
        const jabdaDabda= filteredCal;
        console.log(typeof(filteredCal));
        console.log(filteredCal);

        res.render("Portfolio.ejs", 
        {
            theme: themeThis,
            imgSrc: req.session.passport.user.profile_pic,
            PageTitle: "Portfolio",
            Name: req.session.passport.user.name.split(" ")[0],
            PAndL: Number(user.NetPnL).toFixed(2),
            splineData: jabdaDabda,
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
                'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzIzMjc2MTEwLCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.fF9_mFgdA5kTM9wYaLAudjcJwjUEolWnBruhTrQ_6ugqq5ctaEO5CPmTI59U02G99bsuGaCwn3BduuWQoj5rpQ',
                Accept: 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                resolve(JSON.parse(body));
            }
        });
    });
}

function getTradeHistory(from_date, to_date) {
    const formattedDate = from_date.toISOString().split('T')[0];
    const formattedto_date = to_date.toISOString().split('T')[0];
    const fromDate = '2024-05-13';
    const toDate = '2024-05-18';
    const page = 1;

    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            url: `https://api.dhan.co/tradeHistory/${fromDate}/${toDate}/${page}`,
            headers: {
                'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzIzMjc2MTEwLCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.fF9_mFgdA5kTM9wYaLAudjcJwjUEolWnBruhTrQ_6ugqq5ctaEO5CPmTI59U02G99bsuGaCwn3BduuWQoj5rpQ',
                Accept: 'application/json'
            }
        };

        
        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                resolve(JSON.parse(body));
            }
        });
    });
}

async function generateFakePosition() {
    const positionData = [
        {
          "dhanClientId": "string",
          "tradingSymbol": "First Demo Position",
          "securityId": "1",
          "positionType": "LONG",
          "exchangeSegment": "NSE_EQ",
          "productType": "CNC",
          "buyAvg": 12,
          "costPrice": 123,
          "buyQty": 2,
          "sellAvg": 0,
          "sellQty": 0,
          "netQty": 23,
          "realizedProfit": 123,
          "unrealizedProfit": 2,
          "rbiReferenceRate": 0,
          "multiplier": 2,
          "carryForwardBuyQty": 0,
          "carryForwardSellQty": 0,
          "carryForwardBuyValue": 0,
          "carryForwardSellValue": 0,
          "dayBuyQty": 0,
          "daySellQty": 0,
          "dayBuyValue": 0,
          "daySellValue": 0,
          "drvExpiryDate": "string",
          "drvOptionType": "CALL",
          "drvStrikePrice": 0,
          "crossCurrency": true
        },
        {
            "dhanClientId": "string",
            "tradingSymbol": "Second Demo Position",
            "securityId": "12",
            "positionType": "LONG",
            "exchangeSegment": "NSE_FNO",
            "productType": "CNC",
            "buyAvg": 10,
            "costPrice": 20,
            "buyQty": 30,
            "sellAvg": 0,
            "sellQty": 0,
            "netQty": 20,
            "realizedProfit": -12,
            "unrealizedProfit": 0,
            "rbiReferenceRate": 0,
            "multiplier": 0,
            "carryForwardBuyQty": 0,
            "carryForwardSellQty": 0,
            "carryForwardBuyValue": 0,
            "carryForwardSellValue": 0,
            "dayBuyQty": 0,
            "daySellQty": 0,
            "dayBuyValue": 0,
            "daySellValue": 0,
            "drvExpiryDate": "string",
            "drvOptionType": "CALL",
            "drvStrikePrice": 0,
            "crossCurrency": true
          },
          {
            "dhanClientId": "string",
            "tradingSymbol": "Third Demo Position",
            "securityId": "123",
            "positionType": "LONG",
            "exchangeSegment": "NSE_FNO",
            "productType": "CNC",
            "buyAvg": 10,
            "costPrice": 20,
            "buyQty": 10,
            "sellAvg": 0,
            "sellQty": 0,
            "netQty": 20,
            "realizedProfit": 69,
            "unrealizedProfit": 10,
            "rbiReferenceRate": 0,
            "multiplier": 20,
            "carryForwardBuyQty": 0,
            "carryForwardSellQty": 0,
            "carryForwardBuyValue": 0,
            "carryForwardSellValue": 0,
            "dayBuyQty": 0,
            "daySellQty": 0,
            "dayBuyValue": 0,
            "daySellValue": 0,
            "drvExpiryDate": "string",
            "drvOptionType": "CALL",
            "drvStrikePrice": 0,
            "crossCurrency": true
          }
      ]

    return JSON.parse(JSON.stringify(positionData));
}

async function getChartData(securityID, exchangeSeg, instru) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            url: 'https://api.dhan.co/charts/intraday',
            headers: {
                'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzIzMjc2MTEwLCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.fF9_mFgdA5kTM9wYaLAudjcJwjUEolWnBruhTrQ_6ugqq5ctaEO5CPmTI59U02G99bsuGaCwn3BduuWQoj5rpQ',
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: { securityId: securityID, exchangeSegment: exchangeSeg, instrument: instru },
            json: true
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

async function findCalendarEntryForToday(user) {
    const today = getLocalDate() 
    try {
        const calendarEntry = user.Calendar.find(entry => entry.date === today);
        return calendarEntry || "none";
    } catch (error) {
        console.error("Error finding calendar entry:", error);
        return "error";
    }
}

async function getCurBalance() {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        url: 'https://api.dhan.co/fundlimit',
        headers: {
          'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzIzMjc2MTEwLCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.fF9_mFgdA5kTM9wYaLAudjcJwjUEolWnBruhTrQ_6ugqq5ctaEO5CPmTI59U02G99bsuGaCwn3BduuWQoj5rpQ',
          Accept: 'application/json'
        }
      };
  
      request(options, function (error, response, body) {
        if (error) reject(error);
        else resolve(JSON.parse(body).availabelBalance);
      });
    });
  }

function getTodaysPositions(user) {
    try {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        // Filter positions based on dateOfBuy
        const todaysPositions = user.Positions.filter(position => position.dateOfBuy === formattedDate);
        return todaysPositions;
    } catch (error) {
        console.error('Error retrieving today\'s positions:', error);
        throw error;
    }
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

        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });
        // let allPositions = await getAllPositions();
        let todaysPositions = getTodaysPositions(user)
        
        var hasRecording = new Boolean(0);
        res.render("Positions.ejs", 
        {
            theme: user.theme,
            imgSrc: user.profile_pic,
            PageTitle: "Positions",
            Name: user.name.split(" ")[0],
            isavailable: hasRecording,
            carouselData: todaysPositions,
            Strategies: user.Strategies
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
            headers: {'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzIzMjc2MTEwLCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.fF9_mFgdA5kTM9wYaLAudjcJwjUEolWnBruhTrQ_6ugqq5ctaEO5CPmTI59U02G99bsuGaCwn3BduuWQoj5rpQ', Accept: 'application/json'}
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

function filterDateAndBalance(calendarArray) {
    const filteredArray = calendarArray.map(obj => ({
        date: obj.date,
        balance: obj.balance
    }));

    return filteredArray;
}

app.get("/Overview-Report", (req, res)=>{

    if(req.isAuthenticated()) {
        const options = {
            method: 'GET',
            url: 'https://api.dhan.co/fundlimit',
            headers: {
              'access-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzIzMjc2MTEwLCJ0b2tlbkNvbnN1bWVyVHlwZSI6IlNFTEYiLCJ3ZWJob29rVXJsIjoiIiwiZGhhbkNsaWVudElkIjoiMTEwMDY4NzY5NyJ9.fF9_mFgdA5kTM9wYaLAudjcJwjUEolWnBruhTrQ_6ugqq5ctaEO5CPmTI59U02G99bsuGaCwn3BduuWQoj5rpQ',
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

            let CumRet, NonCumRet, DaiRet, RetWin, RetLoss;
            if (user.Positions == null || user.Positions == undefined || user.Positions.length == 0)
            {
                CumRet= 0;
                NonCumRet= 0;
                DaiRet= 0;
                RetWin= 0;
                RetLoss= 0;
            }
            else
            {
                CumRet= 12;
                NonCumRet= 1.7;
                DaiRet= 26;
                RetWin= 5.6;
                RetLoss= 2.3;
            }

            res.render("Overview-Report.ejs", 
            {
                theme: themeThis,
                imgSrc: req.session.passport.user.profile_pic,
                PageTitle: "Overview Report",
                Name: req.session.passport.user.name.split(" ")[0],
                AccBalance: k,
                CumRet: CumRet,
                NonCumRet: NonCumRet,
                DaiRet: DaiRet,
                RetWin: RetWin,
                RetLoss: RetLoss,
                calData: filteredArray,
                BigPro: user.Biggest_Profit,
                BigLoss: Math.abs(Number(user.Biggest_Loss)),
                carouselData: user.Positions,
                Strategies: user.Strategies
            });
          });
    } else {
        res.redirect("/Home")
    }    
})

app.post("/Setup-Report", async function (req, res) {
    
    const body= req.body;
    let defo= body.strat;

    if(body.strat == 'Select Strategy' || body.strat.length == 0)
        defo= ""

    console.log("Got from setup report post: ", body);

    req.session.SetupObject= {
        defaultSelection: defo
    };
    res.redirect("/Setup-Report");
})

app.get("/Setup-Report", async (req, res)=>{
    if(req.isAuthenticated()) {
        
        const googleClientId= req.session.passport.user.google_client_id;
        const user = await User.findOne({ google_client_id: googleClientId });
        var themeThis= "none";

        const filteredCal = filterDateAndBalance(user.Calendar);
        filteredCal.forEach(obj => {
            obj.date = convertDateFormat(obj.date);
        });
        const jabdaDabda= filteredCal;  //For account graph

        ////////////////////? Report Generation ///////////////////////

        const allPositions= user.Positions;
        
        let SetupGenerated= {}
        for(const thisPosition of allPositions)
        {
            const thisPosStrategy= String(thisPosition.strategyUsed);

            let thisSetup= [];
            let cpIsBaar= Number(Number(thisPosition.costPrice)*Number(thisPosition.buyQty)).toFixed(2) ;
            thisSetup.push(thisPosition.dayOfBuy);
            thisSetup.push(thisPosition.dateOfBuy);
            thisSetup.push(cpIsBaar);
            if(thisPosition.profit > 0) {
                thisSetup.push(thisPosition.profit);
                thisSetup.push(Number(Number(thisPosition.profit)/Number(cpIsBaar) * 100).toFixed(2) );
            }
            else {
                thisSetup.push(0);
                thisSetup.push(0);
            }
            
            if(thisPosition.profit < 0) {
                thisSetup.push(-Number(thisPosition.profit));
                thisSetup.push(Number(Number(thisPosition.profit)/Number(cpIsBaar) * -100).toFixed(2));
            }
            else {
                thisSetup.push(0);
                thisSetup.push(0);
            }
            
            thisSetup.push(thisPosition.multiplier);
            thisSetup.push(thisPosition.curBalance)
            thisSetup.push(thisPosition.brokerage);

            if(!SetupGenerated.hasOwnProperty(thisPosStrategy))
            {
                let tw= 0, tl= 0;
                if(thisPosition.profit > 0)
                    tw= 1;
                else
                    tl= 1;

                SetupGenerated[thisPosStrategy] = {
                    data: [thisSetup],
                    noTrades: 1,
                    totWins: tw,
                    totLoss: tl
                };
            }
            else
            {
                let tw= SetupGenerated[thisPosStrategy].totWins, tl= SetupGenerated[thisPosStrategy].totLoss, ttr= SetupGenerated[thisPosStrategy].noTrades + 1;
                if(thisPosition.profit > 0)
                    tw += 1;
                else
                    tl += 1;

                SetupGenerated[thisPosStrategy].data.push(thisSetup);
                SetupGenerated[thisPosStrategy].noTrades= ttr;
                SetupGenerated[thisPosStrategy].totWins= tw;
                SetupGenerated[thisPosStrategy].totLoss= tl;
            }
        }

        let data, defaultSelection;
        const keys = Object.keys(SetupGenerated);
        const firstKey = keys[0];

        if(firstKey == null || firstKey == undefined || firstKey.length == 0)
        {
            getThemeById(googleClientId)
            .then(theme => {
                // console.log("Strategies:", strategies);
                themeThis= theme;
                console.log("Theme this:"+ themeThis);
                res.render("Setup-Report.ejs", 
                {
                    theme: themeThis,
                    imgSrc: req.session.passport.user.profile_pic,
                    PageTitle: "Setup Report",
                    splineData: jabdaDabda,
                    Name: req.session.passport.user.name.split(" ")[0],
                    gadhbadh: "yes"
                });
            })
        }

        else 
        {
            const firstKeyData = SetupGenerated[firstKey].data;
            let numTrades, totWin, totLos, recommendation;

            if (req.session.SetupObject == undefined || req.session.SetupObject == null || req.session.SetupObject.defaultSelection == "" || req.session.SetupObject.defaultSelection.length == 0) 
            {
                data= firstKeyData
                defaultSelection= firstKey;
                numTrades= SetupGenerated[firstKey].noTrades;
                totWin= SetupGenerated[firstKey].totWins;
                totLos= SetupGenerated[firstKey].totLoss;
            }
            else
            {
                let selected= req.session.SetupObject.defaultSelection;
                data= SetupGenerated[selected].data;
                defaultSelection= req.session.SetupObject.defaultSelection,
                numTrades= SetupGenerated[selected].noTrades;
                totWin= SetupGenerated[selected].totWins;
                totLos= SetupGenerated[selected].totLoss;
            }

            //! Rating part
            if(totLos == 0)
                recommendation= 5;
            else if (totWin == 0)
                recommendation= 1;
            else if(Number(totWin) == Number(totLos))
                recommendation= 3
            else if(Number(totWin) > Number(totLos))
                recommendation= 4
            else if(Number(totWin) < Number(totLos))
                recommendation= 2
            
            if(recommendation > user.Best_Strategy_Rating)
            {
                if (req.session.SetupObject == undefined || req.session.SetupObject == null || req.session.SetupObject.defaultSelection == "" || req.session.SetupObject.defaultSelection.length == 0) 
                {
                    user.Best_Strategy_Rating= recommendation;
                    user.Best_Strategy= firstKey;
                }
                else
                {
                    user.Best_Strategy_Rating= recommendation;
                    user.Best_Strategy= req.session.SetupObject.defaultSelection;
                }
            }

            // let data= user.Setup

            getThemeById(googleClientId)
            .then(theme => {
                // console.log("Strategies:", strategies);
                themeThis= theme;
                console.log("Theme this:"+ themeThis);
                res.render("Setup-Report.ejs", 
                {
                    theme: themeThis,
                    imgSrc: req.session.passport.user.profile_pic,
                    PageTitle: "Setup Report",
                    splineData: jabdaDabda,
                    Name: req.session.passport.user.name.split(" ")[0],
                    data: data,
                    defaultSelection: defaultSelection,
                    selectionData: Object.keys(SetupGenerated),
                    numTrades: numTrades,
                    totWin: totWin,
                    totLos: totLos,
                    recommendation: recommendation,
                    gadhbadh: "no"
                });
            })
            .catch(err => {
                console.error("Error:", err);
            });
        }

        
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
            if(user.Best_Strategy == null || user.Best_Strategy == undefined || user.Best_Strategy.length == 0)
            {
                const randomIndex = Math.floor(Math.random() * user.Strategies.length);
                randStrat= user.Strategies[randomIndex][0];
            }
            else{
                randStrat= user.Best_Strategy;
            }
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
            BigLoss: Math.abs(user.Biggest_Loss)
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

app.post("/SaveDataForPos", async function (req, res) {
    const strat= req.body.strat;
    const descr= req.body.Descr;
    const posId= req.body.posId;
    const pageName= req.body.pageName;

    const googleClientId= req.session.passport.user.google_client_id;
    const user = await User.findOne({ google_client_id: googleClientId });

    const index = user.Positions.findIndex(position => position._id == posId);
    const thisPossy= user.Positions[index];

    thisPossy.text= descr;
    thisPossy.strategyUsed= strat;

    await user.save();
    console.log("Strategy and Notes saved");
    res.redirect(pageName)
})

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

function getEndDate(date) {
    // Split the input date into day, month, and year
    const [day, month, year] = date.split('-').map(Number);

    // Create a new Date object
    const inputDate = new Date(year, month, day); // Month is zero-based in Date object

    // Add 14 days to the input date
    const futureDate = new Date(inputDate);
    futureDate.setDate(inputDate.getDate() + 14);

    // Get the components of the future date
    const futureDay = futureDate.getDate();
    const futureMonth = futureDate.getMonth() + 1; // Month is zero-based, so add 1
    const futureYear = futureDate.getFullYear();

    // Format the components to ensure they have two digits
    const formattedDay = String(futureDay).padStart(2, '0');
    const formattedMonth = String(futureMonth).padStart(2, '0');
    const formattedYear = futureYear;

    // Return the formatted future date
    return `${formattedDay}-${formattedMonth}-${formattedYear}`;
}

app.get("/Profile", async (req, res)=>{
    if(req.isAuthenticated()) {
        var themeThis= "none";
        const googleClientId= req.session.passport.user.google_client_id;
        // const googleClientId= req.session.googleClientId;

        try {
            // Find the document with the given 'google_id'
            const doc = await User.findOne({ google_client_id: googleClientId });
            const startDate= doc.start_day;
            const futureDate = getEndDate(startDate);
            const huiui= getDateForDashboard(futureDate)

            console.log("Account will cease on: ", huiui);
    
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
                endDate: huiui
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
    mainUserId= req.session.passport.user.google_client_id;
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
            console.log("Successfully added new user");
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

function daysPassedSince(startDateStr) {
    const startDateParts = startDateStr.split('-');
    const startDate = new Date(`${startDateParts[2]}-${startDateParts[1]}-${startDateParts[0]}`); // Format: yyyy-mm-dd
    const today = new Date();
    
    // Calculate the difference in milliseconds
    const timeDifference = today.getTime() - startDate.getTime();
    
    // Convert milliseconds to days
    const daysPassed = Math.floor(timeDifference / (1000 * 3600 * 24));

    return daysPassed;
}

app.get("/Buy", async function (req, res) {
    const doc = await User.findOne({ google_client_id: req.session.passport.user.google_client_id });
    const startDate= doc.start_day;
    const daysLeft= 14 - (daysPassedSince(startDate));
    res.render("Buy.ejs", {
        daysLeft: daysLeft
    });
})

app.listen(port, ()=>{
    console.log(`server running on port: ${port}`)
})
