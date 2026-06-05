import { Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlayerFilterDto } from './dto/player-filter.dto';
import { ImportResultDto, PlayerResponseDto } from './dto/player-response.dto';
import { PlayersService } from './players.service';

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import players from API-Football (admin)' })
  @ApiResponse({ status: 200, type: ImportResultDto })
  import(): Promise<ImportResultDto> {
    return this.playersService.importFromApiFootball();
  }

  @Get()
  @ApiOperation({ summary: 'List players with optional filters' })
  @ApiResponse({ status: 200, type: [PlayerResponseDto] })
  findAll(@Query() dto: PlayerFilterDto): Promise<PlayerResponseDto[]> {
    return this.playersService.findAll(dto);
  }
}
