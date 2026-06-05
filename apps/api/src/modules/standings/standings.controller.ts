import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StandingsService } from './standings.service';
import { StandingEntryResponseDto } from './dto/standing-entry-response.dto';

@ApiTags('standings')
@Controller('leagues/:leagueId/standings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StandingsController {
  constructor(private readonly standingsService: StandingsService) {}

  @Get()
  @ApiOperation({ summary: 'Overall standings — cumulative total across all scored rounds' })
  @ApiResponse({ status: 200, type: [StandingEntryResponseDto] })
  @ApiResponse({ status: 404, description: 'Not a member of this league' })
  getStandings(
    @Param('leagueId') leagueId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<StandingEntryResponseDto[]> {
    return this.standingsService.getStandings(leagueId, user.id);
  }

  @Get('rounds/:roundId')
  @ApiOperation({ summary: 'Round standings — scores for a single round' })
  @ApiResponse({ status: 200, type: [StandingEntryResponseDto] })
  @ApiResponse({ status: 404, description: 'Not a member / round not found' })
  getRoundStandings(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<StandingEntryResponseDto[]> {
    return this.standingsService.getRoundStandings(leagueId, roundId, user.id);
  }
}
