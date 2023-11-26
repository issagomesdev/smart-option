
import { RegisterService } from "../../services/bot/register.service";
import * as fs from 'fs';
import axios from 'axios';
import express from "express";
import * as path from 'path';

export default express
  .Router()
  .get('/:token', async(req, res) => {
    const logo1 = 'https://www.smartoptionea.com/images/logo1.png'; 
    const logo2 = 'https://www.smartoptionea.com/images/logo2.png'; 

    const image1 = await axios.get(logo1, { responseType: 'arraybuffer' });
        const imageData1 = Buffer.from(image1.data, 'binary').toString('base64');
        const imageSrc1 = `data:${image1.headers['content-type']};base64,${imageData1}`;

        
        const image2 = await axios.get(logo2, { responseType: 'arraybuffer' });
        const imageData2 = Buffer.from(image2.data, 'binary').toString('base64');
        const imageSrc2= `data:${image2.headers['content-type']};base64,${imageData2}`;
        
        const htmlPath = path.join(__dirname, '../../../confirm.html');
        let result = fs.readFileSync(htmlPath, 'utf-8');

        result = result.replace('{{imagem1}}', `<img src="${imageSrc1}" style="width: 25em;" alt="SmartOption">`);
        result = result.replace('{{imagem2}}', `<img src="${imageSrc2}" style="margin: 1em; width: 100px;" alt="SmartOption">`);
        await RegisterService.verificationEmail(req.params.token)
        .then(() => {
            result = result.replace('{{result}}','<p style="margin:0;text-align:left;padding:24px 24px 24px;margin: 0 auto;font-size:18px;color: #4CAF50;font-weight: bolder;font-size: 1.5em;font-family: system-ui;text-transform: uppercase;">Email Validado com sucesso!</p>');	
        })
        .catch(async(error) => {
            result = result.replace('{{result}}', `<p style="margin:0;text-align:center;padding:24px 24px 24px;margin: 0 auto;font-size:18px;color: #f44336;font-weight: bolder;font-size: 1.5em;font-family: system-ui;text-transform: uppercase;"> ${error.message} </p>`);
        });
        
        
        res.send(result);

});