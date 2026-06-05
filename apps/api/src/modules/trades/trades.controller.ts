import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTradeWindowDto } from './dto/create-trade-window.dto';
import { FreeAgentFilterDto } from './dto/free-agent-filter.dto';
import { ProposeTradeDto } from './dto/propose-trade.dto';
import { SignFreeAgentDto } from './dto/sign-free-agent.dto';
import { TradesService } from './trades.service';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  // ── Trade Windows ─────────────────────────────────────────────────────────────

  @ApiTags('trade-windows')
  @ApiOperation({ summary: 'Create a trade window (owner only)' })
  @Post('leagues/:leagueId/trade-windows')
  createTradeWindow(
    @Param('leagueId') leagueId: string,
    @Req() req: AuthRequest,
    @Body() dto: CreateTradeWindowDto,
  ) {
    return this.tradesService.createTradeWindow(leagueId, req.user.sub, dto);
  }

  @ApiTags('trade-windows')
  @ApiOperation({ summary: 'List trade windows for a league' })
  @Get('leagues/:leagueId/trade-windows')
  listTradeWindows(@Param('leagueId') leagueId: string, @Req() req: AuthRequest) {
    return this.tradesService.listTradeWindows(leagueId, req.user.sub);
  }

  // ── Trades ────────────────────────────────────────────────────────────────────

  @ApiTags('trades')
  @ApiOperation({ summary: 'Propose a 1-for-1 trade (same position)' })
  @Post('leagues/:leagueId/trades')
  proposeTrade(
    @Param('leagueId') leagueId: string,
    @Req() req: AuthRequest,
    @Body() dto: ProposeTradeDto,
  ) {
    return this.tradesService.proposeTrade(leagueId, req.user.sub, dto);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: 'List trades (proposer or receiver)' })
  @Get('leagues/:leagueId/trades')
  listTrades(@Param('leagueId') leagueId: string, @Req() req: AuthRequest) {
    return this.tradesService.listTrades(leagueId, req.user.sub);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: 'Accept a pending trade (receiver only, revalidates everything)' })
  @HttpCode(HttpStatus.OK)
  @Post('trades/:tradeId/accept')
  acceptTrade(@Param('tradeId') tradeId: string, @Req() req: AuthRequest) {
    return this.tradesService.acceptTrade(tradeId, req.user.sub);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: 'Reject a pending trade (receiver only)' })
  @HttpCode(HttpStatus.OK)
  @Post('trades/:tradeId/reject')
  rejectTrade(@Param('tradeId') tradeId: string, @Req() req: AuthRequest) {
    return this.tradesService.rejectTrade(tradeId, req.user.sub);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: 'Cancel a pending trade (proposer only)' })
  @HttpCode(HttpStatus.OK)
  @Post('trades/:tradeId/cancel')
  cancelTrade(@Param('tradeId') tradeId: string, @Req() req: AuthRequest) {
    return this.tradesService.cancelTrade(tradeId, req.user.sub);
  }

  // ── Signings ──────────────────────────────────────────────────────────────────

  @ApiTags('signings')
  @ApiOperation({ summary: 'Sign a free agent, releasing one player of the same position' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('leagues/:leagueId/signings')
  signFreeAgent(
    @Param('leagueId') leagueId: string,
    @Req() req: AuthRequest,
    @Body() dto: SignFreeAgentDto,
  ) {
    return this.tradesService.signFreeAgent(leagueId, req.user.sub, dto);
  }

  @ApiTags('signings')
  @ApiOperation({ summary: 'List free agents in the league (filter by position/country)' })
  @ApiQuery({ name: 'position', required: false, enum: ['GOL', 'DEF', 'MEI', 'ATA'] })
  @ApiQuery({ name: 'countryCode', required: false, type: String })
  @Get('leagues/:leagueId/free-agents')
  listFreeAgents(
    @Param('leagueId') leagueId: string,
    @Req() req: AuthRequest,
    @Query() filter: FreeAgentFilterDto,
  ) {
    return this.tradesService.listFreeAgents(leagueId, req.user.sub, filter);
  }
}
