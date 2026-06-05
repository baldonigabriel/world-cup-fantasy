import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScoringService } from './scoring.service';
import { RoundScoresResponseDto } from './dto/round-scores-response.dto';

@ApiTags('scoring')
@Controller('leagues/:leagueId/rounds/:roundId')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Post('score')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Calculate / recalculate scores for a locked round (owner only, idempotent)',
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Only the owner can trigger scoring' })
  @ApiResponse({ status: 409, description: 'Round must be locked first' })
  scoreRound(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    return this.scoringService.scoreRound(leagueId, roundId, user.id);
  }

  @Get('scores')
  @ApiOperation({ summary: 'Get all team and player scores for a round' })
  @ApiResponse({ status: 200, type: RoundScoresResponseDto })
  getRoundScores(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<RoundScoresResponseDto> {
    return this.scoringService.getRoundScores(leagueId, roundId, user.id);
  }
}
