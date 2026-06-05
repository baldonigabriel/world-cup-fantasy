import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateLeagueDto } from './dto/create-league.dto';
import { JoinLeagueDto } from './dto/join-league.dto';
import { LeagueResponseDto } from './dto/league-response.dto';
import { LeaguesService } from './leagues.service';

@ApiTags('leagues')
@Controller('leagues')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new league' })
  @ApiResponse({ status: 201, type: LeagueResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLeagueDto,
  ): Promise<LeagueResponseDto> {
    return this.leaguesService.create(user.id, dto);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a league by invite code' })
  @ApiResponse({ status: 200, type: LeagueResponseDto })
  @ApiResponse({ status: 404, description: 'League not found' })
  @ApiResponse({ status: 409, description: 'Full / already joined / draft started' })
  join(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: JoinLeagueDto,
  ): Promise<LeagueResponseDto> {
    return this.leaguesService.join(user.id, dto.inviteCode);
  }

  @Get('me')
  @ApiOperation({ summary: 'List leagues the authenticated user belongs to' })
  @ApiResponse({ status: 200, type: [LeagueResponseDto] })
  findMine(@CurrentUser() user: CurrentUserPayload): Promise<LeagueResponseDto[]> {
    return this.leaguesService.findByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get league details and members' })
  @ApiResponse({ status: 200, type: LeagueResponseDto })
  findOne(@Param('id') id: string): Promise<LeagueResponseDto> {
    return this.leaguesService.findById(id);
  }

  @Post(':id/draw')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Draw draft order (owner only)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Only the owner can draw' })
  async draw(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<void> {
    return this.leaguesService.drawDraftOrder(id, user.id);
  }
}
