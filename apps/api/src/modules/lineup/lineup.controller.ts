import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LineupService } from './lineup.service';
import { CreateRoundDto } from './dto/create-round.dto';
import { RoundResponseDto } from './dto/round-response.dto';
import { UpsertLineupDto } from './dto/upsert-lineup.dto';
import { LineupResponseDto } from './dto/lineup-response.dto';

@ApiTags('lineup')
@Controller('leagues/:leagueId')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LineupController {
  constructor(private readonly lineupService: LineupService) {}

  @Post('rounds')
  @ApiOperation({ summary: 'Create a round (owner only)' })
  @ApiResponse({ status: 201, type: RoundResponseDto })
  @ApiResponse({ status: 403, description: 'Only the owner can create rounds' })
  createRound(
    @Param('leagueId') leagueId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRoundDto,
  ): Promise<RoundResponseDto> {
    return this.lineupService.createRound(leagueId, user.id, dto);
  }

  @Get('rounds')
  @ApiOperation({ summary: 'List rounds for a league' })
  @ApiResponse({ status: 200, type: [RoundResponseDto] })
  listRounds(@Param('leagueId') leagueId: string): Promise<RoundResponseDto[]> {
    return this.lineupService.listRounds(leagueId);
  }

  @Post('rounds/:roundId/lock')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Lock a round (owner only) — freezes lineups and creates snapshots' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Only the owner can lock' })
  @ApiResponse({ status: 409, description: 'Round already locked' })
  lockRound(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    return this.lineupService.lockRound(leagueId, roundId, user.id);
  }

  @Put('rounds/:roundId/lineup')
  @ApiOperation({ summary: 'Set or update your lineup for a round' })
  @ApiResponse({ status: 200, type: LineupResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid formation / lineup constraints violated' })
  @ApiResponse({ status: 409, description: 'Round locked / draft not completed' })
  upsertLineup(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpsertLineupDto,
  ): Promise<LineupResponseDto> {
    return this.lineupService.upsertLineup(leagueId, roundId, user.id, dto);
  }

  @Get('rounds/:roundId/lineup')
  @ApiOperation({ summary: 'Get your current lineup for a round' })
  @ApiResponse({ status: 200, type: LineupResponseDto })
  @ApiResponse({ status: 404, description: 'No lineup submitted for this round' })
  getMyLineup(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<LineupResponseDto> {
    return this.lineupService.getMyLineup(leagueId, roundId, user.id);
  }

  @Get('rounds/:roundId/lineups')
  @ApiOperation({ summary: 'Get all lineups for a round' })
  @ApiResponse({ status: 200, type: [LineupResponseDto] })
  getAllLineups(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<LineupResponseDto[]> {
    return this.lineupService.getAllLineups(leagueId, roundId, user.id);
  }
}
