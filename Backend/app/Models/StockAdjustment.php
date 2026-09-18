<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockAdjustment extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'branch_id',
        'system_quantity',
        'actual_quantity',
        'difference',
        'reason',
        'adjusted_at',
        'adjusted_by',
    ];

    protected $casts = [
        'system_quantity' => 'float',
        'actual_quantity' => 'float',
        'difference' => 'float',
        'adjusted_at' => 'string',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function adjuster()
    {
        return $this->belongsTo(User::class, 'adjusted_by');
    }
}