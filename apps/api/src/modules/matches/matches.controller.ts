import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchesService } from './matches.service';
import { IngestFixtureDto } from './dto/ingest-fixture.dto';
import { FixtureResponseDto } from './dto/fixture-response.dto';

@ApiTags('matches')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('fixtures')
  @ApiOperation({ summary: 'Ingest or update fixture facts (idempotent by fixtureId)' })
  @ApiResponse({ status: 201, type: FixtureResponseDto })
  @ApiResponse({ status: 404, description: 'Country code not found' })
  ingestFixture(@Body() dto: IngestFixtureDto): Promise<FixtureResponseDto> {
    return this.matchesService.ingestFixture(dto);
  }

  @Post('leagues/:leagueId/rounds/:roundId/fixtures/:fixtureId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Link an ingested fixture to a round (owner only)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'League / round / fixture not found' })
  @ApiResponse({ status: 409, description: 'Fixture already linked to this round' })
  linkToRound(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    return this.matchesService.linkToRound(leagueId, roundId, fixtureId, user.id);
  }

  @Get('leagues/:leagueId/rounds/:roundId/fixtures')
  @ApiOperation({ summary: 'List fixtures linked to a round' })
  @ApiResponse({ status: 200, type: [FixtureResponseDto] })
  listFixturesForRound(
    @Param('leagueId') leagueId: string,
    @Param('roundId') roundId: string,
  ): Promise<FixtureResponseDto[]> {
    return this.matchesService.listFixturesForRound(leagueId, roundId);
  }
}
