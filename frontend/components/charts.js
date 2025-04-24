// components/charts.js
let timeChart, severityChart, vehicleChart;

// Chart configuration constants
const CHART_CONFIG = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          return `${context.label}: ${context.raw} (${Math.round(context.parsed * 100 / context.dataset.data.reduce((a, b) => a + b, 0))}%)`;
        }
      }
    }
  }
};

const TIME_LABELS = ['00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24'];

export const initCharts = () => {
  try {
    // Time Chart - Accidents by Time of Day
    const timeCtx = document.getElementById('time-chart');
    if (!timeCtx) throw new Error('Time chart canvas element not found');
    
    timeChart = new Chart(timeCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: TIME_LABELS,
        datasets: [{
          label: 'Number of Accidents',
          data: [],
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        ...CHART_CONFIG,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Accidents'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Time of Day'
            }
          }
        }
      }
    });

    // Severity Chart - Fatal vs Non-Fatal
    const severityCtx = document.getElementById('severity-chart');
    if (!severityCtx) throw new Error('Severity chart canvas element not found');
    
    severityChart = new Chart(severityCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Fatal Accidents', 'Non-Fatal Accidents'],
        datasets: [{
          data: [],
          backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(75, 192, 192, 0.7)'],
          borderColor: ['rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)'],
          borderWidth: 1
        }]
      },
      options: CHART_CONFIG
    });

    // Vehicle Chart - Accident Types
    const vehicleCtx = document.getElementById('vehicle-chart');
    if (!vehicleCtx) throw new Error('Vehicle chart canvas element not found');
    
    vehicleChart = new Chart(vehicleCtx.getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Pedestrian', 'Matatu', 'Motorcycle', 'Other'],
        datasets: [{
          data: [],
          backgroundColor: [
            'rgba(255, 159, 64, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(201, 203, 207, 0.7)'
          ],
          borderColor: [
            'rgba(255, 159, 64, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(201, 203, 207, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: CHART_CONFIG
    });

  } catch (error) {
    console.error('Chart initialization error:', error);
    // You might want to display a user-friendly error message here
    const container = document.querySelector('.dashboard');
    if (container) {
      container.innerHTML = `<div class="chart-error">Failed to initialize charts. Please refresh the page.</div>`;
    }
  }
};

export const updateCharts = (accidents) => {
  if (!accidents || !Array.isArray(accidents)) {
    console.warn('Invalid accidents data provided to updateCharts');
    return;
  }

  if (accidents.length === 0) {
    console.log('No accidents data to display');
    // Optionally show empty state or reset charts
    resetCharts();
    return;
  }

  try {
    // Process time data
    const timeData = Array(8).fill(0);
    accidents.forEach(accident => {
      try {
        const crashDate = accident.crash_datetime || accident.crash_date;
        if (!crashDate) return;
        
        const hour = new Date(crashDate).getHours();
        if (isNaN(hour)) return;
        
        const timeSlot = Math.floor(hour / 3) % 8;
        timeData[timeSlot]++;
      } catch (e) {
        console.warn('Error processing accident time data:', e);
      }
    });

    // Process severity data
    const fatalCount = accidents.filter(a => 
      a.contains_fatality_words === true
    ).length;
    const nonFatalCount = accidents.length - fatalCount;

    // Process vehicle type data
    const pedestrianCount = accidents.filter(a => 
      a.contains_pedestrian_words === true
    ).length;
    const matatuCount = accidents.filter(a => 
      a.contains_matatu_words === true
    ).length;
    const motorcycleCount = accidents.filter(a => 
      a.contains_motorcycle_words === true
    ).length;
    const otherCount = accidents.length - pedestrianCount - matatuCount - motorcycleCount;

    // Update charts only if they exist
    if (timeChart) {
      timeChart.data.datasets[0].data = timeData;
      timeChart.update();
    }

    if (severityChart) {
      severityChart.data.datasets[0].data = [fatalCount, nonFatalCount];
      severityChart.update();
    }

    if (vehicleChart) {
      vehicleChart.data.datasets[0].data = [
        pedestrianCount,
        matatuCount,
        motorcycleCount,
        otherCount
      ];
      vehicleChart.update();
    }

  } catch (error) {
    console.error('Error updating charts:', error);
    // Optionally show error to user
  }
};

const resetCharts = () => {
  const emptyData = (timeChart?.data.labels || TIME_LABELS).map(() => 0);
  
  if (timeChart) {
    timeChart.data.datasets[0].data = emptyData;
    timeChart.update();
  }

  if (severityChart) {
    severityChart.data.datasets[0].data = [0, 0];
    severityChart.update();
  }

  if (vehicleChart) {
    vehicleChart.data.datasets[0].data = [0, 0, 0, 0];
    vehicleChart.update();
  }
};