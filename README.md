## Scholarship Scraper

A Node.js web scraper that extracts publicly available scholarship information from IEFA.org.


Here's an example of the scraper in action and the data it produces:

<img src="images/logs_example.png" alt="Logs Example" style="width: 80%; max-width: 600px;"/>

<img src="images/data_example.png" alt="Data Example" style="width: 80%; max-width: 600px;"/>

## Features

- Extracts scholarship data from IEFA.org
- Implements concurrent processing with rate limiting
- Supports proxy usage
- Exports data to JSON and CSV formats
- Includes error handling with retries and logging


## Quick Start

1. Clone the repository:
   ```
   git clone https://github.com/aladynjr/iefa-scholarship-awards-scraper.git
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables in a `.env` file (see `.env.example`).

4. Run the scraper:
   ```
   npm start
   ```

## Output

The scraper generates two files in the `data` directory:
- `scholarship_full_info.json`: Scholarship data in JSON format
- `scholarship_full_info.csv`: Scholarship data in CSV format

## Technologies

- Node.js
- Axios
- Cheerio
- CSV-Writer

## Note

This tool is for educational purposes. Ensure compliance with IEFA.org's terms of service when using this scraper.

