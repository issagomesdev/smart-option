import conn from "../../db";
import { SHA1 } from "crypto-js";
import { NetworkService } from "./network.service";
import * as nodemailer from 'nodemailer';
import * as jwt from 'jsonwebtoken';
import moment from 'moment';

export class RegisterService {

  static async registerUser(body:any, affiliateId:number = null): Promise<any> {
    try {

      let user = (
        await conn.query(`SELECT * FROM bot_users WHERE email = '${body.email}'`)
      )[0][0];

      if(user) throw Error("Email já em uso");

       user = (
        await conn.execute(
          `INSERT INTO bot_users(name, email, password, phone_number, adress, pix_code) VALUES ('${body.name}','${body.email}', '${SHA1(body.password).toString()}','${body.phone_number}','${body.adress}','${body.pix_code}')`
        ))[0]; 
        
        if(affiliateId) NetworkService.upNetwork(affiliateId, user.insertId);
        RegisterService.sendVerificationEmail(body.email)

        return { status: true, message: "Usuário cadastrado com sucesso" }
    } catch (error) {
      throw error;
    }
  }

  static async sendVerificationEmail(email:string){
    let user = (
      await conn.query(`SELECT * FROM bot_users WHERE email = '${email}'`)
    )[0][0];
    const token = jwt.sign({ email }, process.env.SECRET_KEY, { expiresIn: '1h' });
    
    await conn.query(`INSERT INTO verification_email(user_id, token) VALUES ('${user.id}','${token}')`);

    const transporter = nodemailer.createTransport({
      host: 'smtp.titan.email',
      port: 465,
      secure: true,
      auth: {
        user: 'no-reply@smartoptionea.com',
        pass: 'Opea.Bot23',
      },
      tls: {
        rejectUnauthorized: false,
       }
    });

    const mailOptions = {
      from: 'no-reply@smartoptionea.com',
      to: `${email}`,
      subject: 'Confirmação de e-mail',
      html: `<div>
      <p> 
      <img style="width: 25em;" src="https://smartoptionea.com/images/logo1.png" alt="SmartOption">
      </p>
      
      <table cellspacing="0" style="width:100%;margin:0 auto" bgcolor="#F2F3F4">
          <tbody>
              <tr>
                  <td style="background: #000000; height: 5em;">
                      <table cellspacing="0" cellpadding="0" align="center">
                          <tbody>
                              <tr>
                                  <td>
                                      <img style="margin: 1em; width: 100px;" src="https://smartoptionea.com/images/logo2.png" alt="SmartOption">
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </td>
              </tr>
              <tr>
                  <td>
                      <table align="center" style="max-width:552px">
                          <tbody>
                              <tr>
                                  <td>
                                      <div style="margin:10px;width:552px;height:auto;background:#ffffff 0% 0% no-repeat padding-box">
                                          <div style="text-align:center">
                                              <p style="margin:0;text-align:left;padding:24px 24px 24px;font-size:18px;color:#333333">Para seguir, basta confirmar seu endereço de e-mail clicando no botão abaixo:</p>
                                              <a href="${process.env.API_BASE_PATH}/email/verify/${token}" style="display:inline-block;width:300px;margin:24px;padding:20px;border-radius:5px;font-size:20px;text-align:center;letter-spacing:0;background:linear-gradient(to bottom, #51d176 10%,#29c1b1 80%);text-decoration:none;color:#fff" target="_blank">Confirmar meu e-mail</a>
                                              <p style="text-align:center;margin:0 24px 24px 24px;font-size:14px;color:#333333">Caso não tenha sido você que tentou criar esta conta, desconsidere este e-mail.</p>
                                          </div>
                                          <div>
                                              <p style="padding:24px;color:#333333;text-align:left;font-size:12px">Caso tenha alguma dificuldade para fazer a confirmação no botão acima, copie e cole a URL a seguir no seu navegador:
                                              
                                              <span style="text-decoration:underline;color:#4480c5;word-break:break-all">
                                              
                                              <a href="${process.env.API_BASE_PATH}/email/verify/${token}" target="_blank"> ${process.env.API_BASE_PATH}/email/verify/${token} </a>
                                              
                                              </span>
                                              </p>
                                          </div>
                                      </div>
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </td>
              </tr>
          </tbody>
      </table>
  </div>`,
    };

      transporter.sendMail(mailOptions, async(error, info) => {
        //console.log(info)
        if (error) {
         // console.log(error.message)
        }
    });
  }

  static async verificationEmail(token:string){

  if (!token) throw Error("Token ausente");

  const decodedToken: any = jwt.verify(token, process.env.SECRET_KEY);

  console.log()
  const today = Math.floor(Date.now() / 1000);
  let user = (
    await conn.query(`SELECT user_id FROM verification_email WHERE token = '${token}'`)
  )[0][0];

  if(user && user.user_id){

    let verified_email_at = (
      await conn.query(`SELECT verified_email_at FROM bot_users WHERE id = '${user.user_id}'`)
    )[0][0];

    if(verified_email_at && verified_email_at.verified_email_at){

      await conn.query(`UPDATE verification_email SET status='checked' WHERE user_id = '${user.user_id}'`)
      throw Error("Email já validado");

    } else if (decodedToken.exp && decodedToken.exp < today){

      await conn.query(`UPDATE verification_email SET status='expired' WHERE token = '${token}'`)
      throw Error("Token inválido ou expirado! Realize o login para solicitar um novo email de confirmação");

    } else {

        await conn.query(`UPDATE verification_email SET status='checked' WHERE user_id = '${user.user_id}'`)
        await conn.query(`UPDATE bot_users SET verified_email_at='${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE id = '${user.user_id}'`);
    }
    
  } else {
    throw Error("Token inválido");
  }
  }

}


