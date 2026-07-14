const LOGO_HEADER_URL = "https://media.byissa.dev/smart-option/logo.png";
const LOGO_BAR_URL = "https://media.byissa.dev/smart-option/logo.png";

function renderLayout(bodyHtml: string): string {
  return `<div>
      <p>
      <img style="width: 25em;" src="${LOGO_HEADER_URL}" alt="SmartOption">
      </p>

      <table cellspacing="0" style="width:100%;margin:0 auto" bgcolor="#F2F3F4">
          <tbody>
              <tr>
                  <td style="background: #000000; height: 5em;">
                      <table cellspacing="0" cellpadding="0" align="center">
                          <tbody>
                              <tr>
                                  <td>
                                      <img style="margin: 1em; width: 100px;" src="${LOGO_BAR_URL}" alt="SmartOption">
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
                                              ${bodyHtml}
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
  </div>`;
}

export interface CtaEmailInput {
  title?: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
  footer?: string;
}

/** E-mail com um botão de ação (verificação de e-mail, recuperação de senha). */
export function renderCtaEmail(input: CtaEmailInput): string {
  const heading = input.title
    ? `<p style="margin:0;text-align:left;padding:24px 24px 0;font-size:20px;color:#333333;font-weight:bold">${input.title}</p>`
    : "";

  return renderLayout(`
    ${heading}
    <p style="margin:0;text-align:left;padding:24px 24px 24px;font-size:18px;color:#333333">${input.message}</p>
    <a href="${input.ctaUrl}" style="display:inline-block;width:300px;margin:24px;padding:20px;border-radius:5px;font-size:20px;text-align:center;letter-spacing:0;background:linear-gradient(to bottom, #51d176 10%,#29c1b1 80%);text-decoration:none;color:#fff" target="_blank">${input.ctaLabel}</a>
    ${input.footer ? `<p style="text-align:center;margin:0 24px 24px 24px;font-size:14px;color:#333333">${input.footer}</p>` : ""}
    <div>
      <p style="padding:24px;color:#333333;text-align:left;font-size:12px">Caso tenha alguma dificuldade para clicar no botão acima, copie e cole a URL a seguir no seu navegador:
      <span style="text-decoration:underline;color:#4480c5;word-break:break-all">
      <a href="${input.ctaUrl}" target="_blank"> ${input.ctaUrl} </a>
      </span>
      </p>
    </div>
  `);
}

export interface InfoEmailInput {
  title: string;
  message: string;
}

/** E-mail somente informativo, sem botão de ação (depósito confirmado, saque solicitado/aprovado, etc). */
export function renderInfoEmail(input: InfoEmailInput): string {
  return renderLayout(`
    <p style="margin:0;text-align:left;padding:24px 24px 0;font-size:20px;color:#333333;font-weight:bold">${input.title}</p>
    <p style="margin:0;text-align:left;padding:24px;font-size:16px;color:#333333">${input.message}</p>
  `);
}
