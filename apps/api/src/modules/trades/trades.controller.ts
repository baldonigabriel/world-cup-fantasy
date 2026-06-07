import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTradeWindowDto } from './dto/create-trade-window.dto';
import { FreeAgentFilterDto } from './dto/free-agent-filter.dto';
import { ProposeTradeDto } from './dto/propose-trade.dto';
import { SignFreeAgentDto } from './dto/sign-free-agent.dto';
import { TradesService } from './trades.service';

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
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTradeWindowDto,
  ) {
    return this.tradesService.createTradeWindow(leagueId, user.id, dto);
  }

  @ApiTags('trade-windows')
  @ApiOperation({ summary: 'List trade windows for a league' })
  @Get('leagues/:leagueId/trade-windows')
  listTradeWindows(@Param('leagueId') leagueId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.tradesService.listTradeWindows(leagueId, user.id);
  }

  // ── Trades ────────────────────────────────────────────────────────────────────

  @ApiTags('trades')
  @ApiOperation({ summary: 'Propose a 1-for-1 trade (same position)' })
  @Post('leagues/:leagueId/trades')
  proposeTrade(
    @Param('leagueId') leagueId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ProposeTradeDto,
  ) {
    return this.tradesService.proposeTrade(leagueId, user.id, dto);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: 'List trades (proposer or receiver)' })
  @Get('leagues/:leagueId/trades')
  listTrades(@Param('leagueId') leagueId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.tradesService.listTrades(leagueId, user.id);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: "List a roster's players (any league member can view)" })
  @Get('leagues/:leagueId/rosters/:rosterId')
  listRosterPlayers(
    @Param('leagueId') leagueId: string,
    @Param('rosterId') rosterId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tradesService.listRosterPlayers(leagueId, rosterId, user.id);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: 'Accept a pending trade (receiver only, revalidates everything)' })
  @HttpCode(HttpStatus.OK)
  @Post('trades/:tradeId/accept')
  acceptTrade(@Param('tradeId') tradeId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.tradesService.acceptTrade(tradeId, user.id);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: 'Reject a pending trade (receiver only)' })
  @HttpCode(HttpStatus.OK)
  @Post('trades/:tradeId/reject')
  rejectTrade(@Param('tradeId') tradeId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.tradesService.rejectTrade(tradeId, user.id);
  }

  @ApiTags('trades')
  @ApiOperation({ summary: 'Cancel a pending trade (proposer only)' })
  @HttpCode(HttpStatus.OK)
  @Post('trades/:tradeId/cancel')
  cancelTrade(@Param('tradeId') tradeId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.tradesService.cancelTrade(tradeId, user.id);
  }

  // ── Signings ──────────────────────────────────────────────────────────────────

  @ApiTags('signings')
  @ApiOperation({ summary: 'Sign a free agent, releasing one player of the same position' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('leagues/:leagueId/signings')
  signFreeAgent(
    @Param('leagueId') leagueId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SignFreeAgentDto,
  ) {
    return this.tradesService.signFreeAgent(leagueId, user.id, dto);
  }

  @ApiTags('signings')
  @ApiOperation({ summary: 'List free agents in the league (filter by position/country)' })
  @ApiQuery({ name: 'position', required: false, enum: ['GOL', 'DEF', 'MEI', 'ATA'] })
  @ApiQuery({ name: 'countryCode', required: false, type: String })
  @Get('leagues/:leagueId/free-agents')
  listFreeAgents(
    @Param('leagueId') leagueId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query() filter: FreeAgentFilterDto,
  ) {
    return this.tradesService.listFreeAgents(leagueId, user.id, filter);
  }
}
