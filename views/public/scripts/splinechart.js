var data = [
	{
		date: "12-05-2024",
		balance: 5000000
	},
	{
		date: "12-06-2024",
		balance: 7000000
	},
	{
		date: "12-07-2024",
		balance: 3000000
	},
	{
		date: "12-08-2024",
		balance: 25000000
	},
	{
		date: "12-09-2024",
		balance: 38000000
	},
	{
		date: "12-10-2024",
		balance: 13000000
	},
	{
		date: "12-11-2024",
		balance: 31000000
	},
	{
		date: "12-12-2024",
		balance: 9000000
	},
	{
		date: "12-13-2024",
		balance: 13000000
	},
	{
		date: "12-14-2024",
		balance: 2000000
	},
]

var dataPoints0 = data.map(item => ({ x: new Date(item.date), y: item.balance }));
console.log(dataPoints0);
var chart = new CanvasJS.Chart("container-spline-chart", {
	animationEnabled: true,  
	title:{
		text: "Account Graph",
        fontColor: "#ffffff",
       horizontalAlign: "center",
	   margin:30,
	   fontSize: 50,
	   fontFamily: "Calibri, sans-serif"
	   
	},
	axisX: {
		labelFontColor: "#bbbbbb", // Set label text color to white
		valueFormatString: "DD"
	},
	axisY: {
		// Set title text color to white
		labelFontColor: "#bbbbbb", // Set label text color to white
		valueFormatString: "#,##0",
		suffix: "",
		prefix: "",
		tickValues: [0, 5000000, 10000000, 15000000, 20000000, 25000000, 30000000, 35000000, 40000000], // Set specific tick values
        interval: 5000000
	},
	data: [{
		type: "splineArea",
		color: "rgba(112, 215, 144, 0.7)",
        markerType: "none",
		markerSize: 5,
      fillOpacity: 0.9 ,
	  
		yValueFormatString: "#,##0.##",
		dataPoints: dataPoints0
		
	}]
	});
    chart.options.backgroundColor = "#15161a"; // parrot green

chart.render();