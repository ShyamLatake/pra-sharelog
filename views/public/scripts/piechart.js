const doughnutData = {
    labels: ['Equity', 'Futures & Options', 'Commodity', 'Currency'],
    data: [300, 50, 100, 200], //! Get data from DB
    backgroundColors: [ 
        '#219ebc',
        '#652f8d',
        '#ffb703',
        '#fb8500'
    ]
};

const ctx = document.getElementById('doughnut-chart').getContext('2d');

const myDoughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
        labels: doughnutData.labels,
        datasets: [{
            label: 'My Doughnut Dataset',
            data: doughnutData.data,
            backgroundColor: doughnutData.backgroundColors,
            hoverOffset: 5,
            borderColor: "#17181a",

            
        }]
    },
    options: {
        cutout: '70%',
        responsive: true,
        plugins: {
            legend: {
                display: false,
                position: 'bottom',
                labels: {
                    // Limit the number of columns for legends
                    boxWidth: 25, // Adjust the width to control the number of columns
                    boxHeight: 25
                },
                padding: {
                    top: 50,
                    right: 15,
                    bottom: 50,
                    left: 20,
                }
            }
        },
        animation: {
            duration: 2000 // Set duration in milliseconds (default is 1000)
        }
    },
});

const infoContainer = document.getElementById('color-boxes');

doughnutData.labels.forEach((label, index) => {
  const infoItem = document.createElement('div');
  infoItem.classList.add('chart-container'); // Add a class for styling
  infoItem.style.backgroundColor = doughnutData.backgroundColors[index];
  infoItem.innerHTML = `${label}`;
  infoContainer.appendChild(infoItem);
});
