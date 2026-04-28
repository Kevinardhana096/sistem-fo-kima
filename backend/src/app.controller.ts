import { Controller, Get, All, Req, Res, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import type { Request, Response } from 'express';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/health')
  getHealth() {
    return this.appService.getHealth();
  }

  @All('valhalla/*path')
  async proxyValhalla(@Req() req: Request, @Res() res: Response) {
    const path = (req.params as any).path;
    const url = `http://valhalla:8002/${path}`;
    
    try {
      const response = await fetch(url, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) 
          ? JSON.stringify(req.body) 
          : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      this.logger.error(`Error proxying to Valhalla: ${error.message}`);
      return res.status(500).json({
        message: 'Error connecting to Valhalla service',
        error: error.message,
      });
    }
  }
}
