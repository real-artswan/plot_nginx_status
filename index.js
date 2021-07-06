/**
 * Add to nginx conf
location /nginx_status {
		# Turn on stats
		stub_status on;
		access_log  off;
		# only allow access from
		// allow 127.0.0.1;
		deny all;
}
Then fix your url here
 */
const URL = 'http://127.0.0.1/nginx_status';
const PERIOD = 1000;

const http = require('https');

const plotConfig = {
	seconds : true,
	interval: PERIOD,
	keep: true,
}

const turtle = require('turtle-race')(plotConfig);
const metricConnections = turtle.metric('CONNS');
const metricRps = turtle.metric('RPS');
const metricReading = turtle.metric('READ');
const metricWriting = turtle.metric('WRITE');
const metricWaiting = turtle.metric('WAIT');

/**
 * Response example:
 * Active connections: 14 
 * server accepts handled requests
 *  2127 2127 121466 
 * Reading: 0 Writing: 5 Waiting: 9 
 */
function parseNginxStatusResponse(resStr) {
	const parseLine = (regex, str) => {
		try {
			return Number(regex.exec(str)[1]);
		} catch {
			return 0;
		}
	}
	const result = {};
	const lines = resStr.split('\n');
	result.activeConnections = parseLine(/([0-9]+)/, lines[0]);
	const requests = lines[2].trim().split(' ');
	result.acceptedRequests = Number(requests[0]);
	result.handledRequests = Number(requests[1]);
	result.totalRequests = Number(requests[2]);
	result.reading = parseLine(/Reading:\s([0-9]+)\s/, lines[3]);
	result.writing = parseLine(/Writing:\s([0-9]+)\s/, lines[3]);
	result.waiting = parseLine(/Waiting:\s([0-9]+)\s/, lines[3]);
	return result;
}

let prevTimeSec = null;
let prevRequestsValue = null;

function fetchData() {
	http.get(URL, (res) => {
		let rawData = '';
		res.on('data', (chunk) => { rawData += chunk; });
		res.on('end', () => {
			try {
				const parsedData = parseNginxStatusResponse(rawData);

				const currTimeSec = Date.now() / 1000;
				let rps = 0;
				if (prevRequestsValue && prevRequestsValue) {
					const sampleTime = currTimeSec - prevTimeSec;
					rps = (parsedData.totalRequests - prevRequestsValue) / sampleTime;
				}
				prevTimeSec = currTimeSec;
				prevRequestsValue = parsedData.totalRequests;

				metricConnections.push(parsedData.activeConnections);
				metricRps.push(rps);
				metricReading.push(parsedData.reading);
				metricWriting.push(parsedData.writing);
				metricWaiting.push(parsedData.waiting);
			} catch (e) {
				console.error(e.message);
			}
		});
	});
}

setInterval(fetchData, PERIOD);