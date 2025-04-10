import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';
const JOB_LINK = 'https://www.amazon.jobs/content/en/career-programs/university/jobs-for-grads?country%5B%5D=US&category%5B%5D=Software+Development&employment-type%5B%5D=Full+time&employment-type%5B%5D=Intern';
const getDirname = (importMetaUrl) => {
    return path.dirname(new URL(importMetaUrl).pathname);
};
const hashJson = (jsonString) => {
    return crypto.createHash('sha512')
        .update(JSON.stringify(jsonString))
        .digest('hex');
};
const getJobs = async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(JOB_LINK);
    await page.setViewport({ width: 1080, height: 1024 });
    await page.waitForSelector('.job-card-module_root__QYXVA');
    const jobs = await page.$$eval('.job-card-module_root__QYXVA', elements => elements.map((el) => {
        const title = el.querySelector('.header-module_header__pAds2 a')?.textContent.trim() || 'No title';
        const link = el.querySelector('a')?.href || '';
        const jobIdMatch = link.match(/\/jobs\/(\d+)/);
        const jobId = jobIdMatch ? jobIdMatch[1] : 'No job ID';
        const locationsRawArray = el.querySelectorAll('.metadatum-module_text__ncKFr');
        let locationsArray = [];
        for (let i = 0; i < locationsRawArray.length - 1; i++) {
            locationsArray.push(locationsRawArray[i].textContent.trim());
        }
        const locations = locationsArray.join(';;') || 'No location';
        const lastUpdatedRaw = el.querySelectorAll('.metadatum-module_text__ncKFr')[locationsRawArray.length - 1]?.textContent.trim() || 'No date';
        const lastUpdated = lastUpdatedRaw.match(/\d{1,2}\/\d{1,2}\/\d{4}/)?.[0] || 'No date';
        const description = el.querySelector('.job-card-module_content__8sS0J')?.textContent.trim() || 'No description';
        return {
            jobId,
            title,
            locations,
            lastUpdated,
            description,
            link
        };
    }));
    await browser.close();
    return jobs;
};
const saveJobs = (jobs) => {
    const dir = path.join(getDirname(import.meta.url), 'jobs');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, 'amazon_jobs.json');
    fs.writeFileSync(filePath, JSON.stringify(jobs, null, 2), 'utf-8');
    console.log(`Jobs data saved to ${filePath}`);
};
const saveJobsHash = (hash) => {
    const dir = path.join(getDirname(import.meta.url), 'jobshash');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, 'amazon_jobs_hash.txt');
    fs.writeFileSync(filePath, hash, 'utf-8');
    console.log(`Hash data saved to ${filePath}`);
};
const emailConfig = {
    service: 'Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    }
};
const transporter = nodemailer.createTransport({
    service: emailConfig.service,
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass,
    }
});
const notifyUser = (goodMessage) => {
    const mailOptions = {
        from: emailConfig.auth.user,
        to: emailConfig.auth.user,
        subject: goodMessage ? 'New Amazon Jobs Found!' : 'No New Amazon Jobs',
        text: goodMessage ? 'New jobs have been found on Amazon!' : 'No new jobs found on Amazon.',
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        }
        else {
            console.log('Email sent:', info.response);
        }
    });
};
const driverProgram = async () => {
    const jobs = await getJobs();
    const newJobsJson = JSON.stringify(jobs, null, 2);
    const newHash = hashJson(newJobsJson);
    const hashFilePath = path.join(getDirname(import.meta.url), 'jobshash', 'amazon_jobs_hash.txt');
    if (fs.existsSync(hashFilePath)) {
        const oldHash = fs.readFileSync(hashFilePath, 'utf-8');
        if (!(oldHash === newHash)) {
            console.log('New jobs found');
            saveJobs(jobs);
            saveJobsHash(newHash);
            await notifyUser(true);
        }
        else {
            console.log('No changes detected.');
            await notifyUser(false);
        }
    }
    else {
        saveJobs(jobs);
        saveJobsHash(newHash);
        console.log('First save done');
    }
};
// Uncomment the following line to run the function directly without Google Cloud Functions
// driverProgram();
// Uncomment the following lines to run the function as a Google Cloud Function
export const root = async (req, res) => {
    try {
        console.log(puppeteer.executablePath());
        await driverProgram();
        res.status(200).send('Success');
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
//# sourceMappingURL=main.js.map