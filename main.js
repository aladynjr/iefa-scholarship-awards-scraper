const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const clc = require('cli-color');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();

const fetchScholarshipListPage = async () => {
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://www.iefa.org/scholarships/US/?per-page=',
        headers: { 
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 
          'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
          'cache-control': 'no-cache', 
          'referer': 'https://www.iefa.org/scholarships/US/', 
          'upgrade-insecure-requests': '1', 
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        }
      };
      
    try {
        const response = await axios.request(config);
        const filePath = path.join(__dirname, 'data', 'all_scholarships.html');
        fs.writeFileSync(filePath, response.data);
        console.log(`Response saved to ${filePath}`);
    }
    catch (error) {
        console.log(error);
    }
}

const parseScholarshipListPage = (filePath) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(fileContent);
    const entries = $('#award-grid > table > tbody > tr');
    return entries.map((i, elem) => {
        const awardName = $(elem).find('a[href^="/scholarships/"]').text().trim().replace('FEATURED', '');
        const nationality = $(elem).find('.award-list-nationality ').text().trim().replace('Nationality: ', '');
        const hostCountries = $(elem).find('.award-list-location ').text().trim().replace('Host Countries: ', '');
        const link = 'https://www.iefa.org/scholarships' + $(elem).find('a[href^="/scholarships/"]').attr('href');
        return { awardName, nationality, hostCountries, link };
    }).toArray();
};

const HttpsProxyAgent = require('https-proxy-agent');
const scrapeScholarshipDetails = async (scholarshipPageUrl) => {
    const proxyUrl = process.env.PROXY_URL;
    const httpsAgent = new HttpsProxyAgent(proxyUrl);

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: scholarshipPageUrl,
        headers: { 
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        httpsAgent: httpsAgent
    };
      
    try {
        const response = await axios.request(config);
        const $ = cheerio.load(response.data);
        const sectionSelector = 'body > div:nth-child(3) > div > div > div > section';
        
        const extractedData = {
            sponsor: $(sectionSelector).find('span.text-secondary').text().replace('Sponsor: ', '').trim(),
            description: $(sectionSelector).find('.award-description > p:first-of-type').text().trim(),
            otherCriteria: $(sectionSelector).find('h4:contains("Other Criteria") + p').text().trim(),
            fieldsOfStudy: $(sectionSelector).find('#award-fieldofstudy').text().trim(),
            awardAmount: $(sectionSelector).find('#award-amount').text().trim()
        };

        return extractedData;
    }
    catch (error) {
        console.error(`Error extracting data from ${scholarshipPageUrl}:`, error.message);
        return null;
    }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


const scrapeAllScholarshipsWithRateLimiting = async (scholarships, outputFilePath, concurrencyLimit = 5) => {
    console.log(clc.yellow(`Number of scholarships to process: ${scholarships.length}`));
    
    // Initialize the output file with an empty array
    fs.writeFileSync(outputFilePath, '[]');

    let successfullyProcessed = 0;

    const scrapeAndSaveScholarshipDetails = async (scholarship, index) => {
        console.log(clc.blue(`\nProcessing scholarship ${index + 1} of ${scholarships.length}: `) + 
                    clc.blue(`Name: ${scholarship.awardName} | ${scholarship.link}`));
        let detailedData = null;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries && !detailedData) {
            try {
                detailedData = await scrapeScholarshipDetails(scholarship.link);
            } catch (error) {
                console.log(clc.yellow(`Attempt ${retries + 1} failed. Retrying...`));
                retries++;
                if (retries === maxRetries) {
                    console.log(clc.red(`Failed to process after ${maxRetries} attempts: ${scholarship.awardName}`));
                    return;
                }
                await delay(5000); // Wait for 5 seconds before retrying
            }
        }
        
        if (detailedData) {
            const mergedData = { ...scholarship, ...detailedData };
            
            // Read the current content of the file
            const currentContent = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
            
            // Append the new data
            currentContent.push(mergedData);
            
            // Write the updated content back to the file
            fs.writeFileSync(outputFilePath, JSON.stringify(currentContent, null, 2));
            
            successfullyProcessed++;
            const percentage = (successfullyProcessed / scholarships.length * 100).toFixed(2);
            console.log(clc.green(`\n(${percentage}%) Successfully extracted and saved : `) + 
                        clc.cyan(`Sponsor: `) + clc.yellow(`${detailedData.sponsor}`) + ` | ` +
                        clc.cyan(`Description: `) + clc.yellow(`${detailedData.description.replace(/\n/g, ' ').substring(0, 50)}...`) + ` | ` +
                        clc.cyan(`Other Criteria: `) + clc.yellow(`${detailedData.otherCriteria.replace(/\n/g, ' ').substring(0, 50)}...`) + ` | ` +
                        clc.cyan(`Fields of Study: `) + clc.yellow(`${detailedData.fieldsOfStudy}`) + ` | ` +
                        clc.cyan(`Award Amount: `) + clc.yellow(`${detailedData.awardAmount}`) + ` | ` +
                        clc.cyan(`Award Name: `) + clc.yellow(`${scholarship.awardName}`) + ` | ` +
                        clc.cyan(`Link: `) + clc.yellow(`${scholarship.link}`) + ` | ` +
                        clc.cyan(`Nationality: `) + clc.yellow(`${scholarship.nationality}`) + ` | ` +
                        clc.cyan(`Host Countries: `) + clc.yellow(`${scholarship.hostCountries}`));
        } else {
            console.log(clc.red(`Failed to process: ${scholarship.awardName}`));
        }
    };

    const queue = scholarships.map((scholarship, index) => 
        () => scrapeAndSaveScholarshipDetails(scholarship, index)
    );

    const executeTasksWithConcurrencyLimit = async (queue, concurrency) => {
        const workers = new Array(concurrency).fill(Promise.resolve());

        const executeTask = async (task) => {
            await task();
            if (queue.length) {
                return executeTask(queue.shift());
            }
        };

        while (queue.length) {
            const freeWorkerIndex = await Promise.race(workers.map((w, i) => w.then(() => i)));
            workers[freeWorkerIndex] = executeTask(queue.shift());
        }

        return Promise.all(workers);
    };

    await executeTasksWithConcurrencyLimit(queue, concurrencyLimit);
};

const main = async () => {
    const dataFolder = path.join(__dirname, 'data');
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder);
        console.log(clc.green('Data folder created successfully.'));
    }

    // Rest of your existing main function code...
    const filePath = path.join(dataFolder, 'all_scholarships.html');
    const outputFilePath = path.join(dataFolder, 'scholarship_full_info.json');


    if (!fs.existsSync(filePath)) {
        console.log(clc.cyan("Fetching list of all awards..."));
        await fetchScholarshipListPage();
    }

    console.log(clc.cyan("Extracting and cleaning scholarship data..."));
    const scholarships = parseScholarshipListPage(filePath);
    
   if (!fs.existsSync(outputFilePath)) {
       console.log(clc.cyan("Extracting detailed scholarship data..."));
       await scrapeAllScholarshipsWithRateLimiting(scholarships, outputFilePath, 5);
   } else {
       console.log(clc.yellow("Detailed scholarship data already exists. Skipping extraction."));
   }
    console.log(clc.magenta(`\nAll scholarships processed. Full information saved to ${outputFilePath}`));

    // Convert JSON to CSV
    const jsonData = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
    const csvFilePath = path.join(__dirname, 'data', 'scholarship_full_info.csv');
    const csvWriter = createCsvWriter({
        path: csvFilePath,
        header: Object.keys(jsonData[0]).map(key => ({id: key, title: key}))
    });

    await csvWriter.writeRecords(jsonData);
    console.log(clc.magenta(`\nCSV file created at ${csvFilePath}`));
}




// run this file to start 
main().catch(error => console.error(clc.red("An error occurred in the main function:"), error));
