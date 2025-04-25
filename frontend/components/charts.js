let timeChart, trendChart, vehicleChart;

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
          return `${context.dataset.label}: ${context.raw}`;
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

    // Trend Chart - Accidents Over Time (replaces severity chart)
    const trendCtx = document.getElementById('severity-chart');
    if (!trendCtx) throw new Error('Trend chart canvas element not found');
    
    trendChart = new Chart(trendCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Accidents',
          data: [],
          fill: false,
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2,
          tension: 0.1
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
              text: 'Time Period'
            }
          }
        }
      }
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

    // Process trend data (by month)
    const trendData = {};
    accidents.forEach(accident => {
      try {
        const crashDate = accident.crash_datetime || accident.crash_date;
        if (!crashDate) return;
        
        const date = new Date(crashDate);
        if (isNaN(date.getTime())) return;
        
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        trendData[monthYear] = (trendData[monthYear] || 0) + 1;
      } catch (e) {
        console.warn('Error processing accident date data:', e);
      }
    });

    // Sort trend data by date
    const sortedTrendDates = Object.keys(trendData).sort();
    const trendLabels = sortedTrendDates.map(date => {
      const [year, month] = date.split('-');
      return `${new Date(year, month-1).toLocaleString('default', { month: 'short' })} ${year}`;
    });
    const trendValues = sortedTrendDates.map(date => trendData[date]);

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

    // Update charts
    if (timeChart) {
      timeChart.data.datasets[0].data = timeData;
      timeChart.update();
    }

    if (trendChart) {
      trendChart.data.labels = trendLabels;
      trendChart.data.datasets[0].data = trendValues;
      trendChart.update();
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
  }
};

const resetCharts = () => {
  const emptyData = (timeChart?.data.labels || TIME_LABELS).map(() => 0);
  
  if (timeChart) {
    timeChart.data.datasets[0].data = emptyData;
    timeChart.update();
  }

  if (trendChart) {
    trendChart.data.labels = [];
    trendChart.data.datasets[0].data = [];
    trendChart.update();
  }

  if (vehicleChart) {
    vehicleChart.data.datasets[0].data = [0, 0, 0, 0];
    vehicleChart.update();
  }
};