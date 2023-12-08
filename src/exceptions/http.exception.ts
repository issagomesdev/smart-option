export class HttpException extends Error {
    constructor(public code: number, error: Error | string = '') {
      super(error instanceof Error ? error.message : error);      

      if (code !== 400 || !this.message){        
        this.message = `${getMessageByCode(code)} ${this.message}`;
      }

    }
  }
  
  export const getMessageByCode = (code: number) => {
    switch (code) {
      case 400: return 'Solicitação inválida.';
      case 401: return 'Acesso autorizado apenas para usuários autenticados.';
      case 402: return 'Você não tem permissão para acessar essa informação.';
    }
  };
  
  export const httpErrors = (code, message?) => {
    return {
      code, 
      message: `${getMessageByCode(code)} ${message}`.trim() 
    }
  };
  
  export default HttpException;
  